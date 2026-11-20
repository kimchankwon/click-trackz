import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { SEED, startBackend, type Backend } from "./backend.mts";
import {
  bootDevice,
  clearStatusBar,
  ensureBuild,
  finishScreenshot,
  installFresh,
  resolveDevice,
  pinStatusBar,
  restoreAfterPrebuild,
  runMaestroFlow,
  shutDownIfWeBooted,
  uninstall,
} from "./ios.mts";
import { planFor, type FeatureMap, type Plan } from "./plan.mts";
import {
  beginStopping,
  cacheDir,
  httpOk,
  killAllNow,
  reconcile,
  releaseLock,
  requireFreePort,
  root,
  run,
  start,
  stop,
  stopAll,
  takeLock,
  waitFor,
} from "./processes.mts";

type Platform = "ios" | "web";
type Step = {
  id: string;
  kind: "check" | "flow" | "setup";
  platform?: Platform;
  ok: boolean;
  durationMs: number;
  screenshot?: string;
  log?: string;
  error?: string;
};

const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const EXIT_UNMAPPED = 3;

const map: FeatureMap = JSON.parse(readFileSync(path.join(import.meta.dirname, "feature-map.json"), "utf8"));
const say = (line = "") => process.stdout.write(`${line}\n`);
const relative = (file: string) => path.relative(root, file);

function parseCli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      platform: { type: "string", default: "both" },
      label: { type: "string", default: "after" },
      full: { type: "boolean", default: false },
      only: { type: "string", multiple: true, default: [] },
      "dry-run": { type: "boolean", default: false },
      unattended: { type: "boolean", default: false },
      base: { type: "string", default: process.env.VERIFY_BASE ?? "origin/main" },
    },
  });
  const platforms: Platform[] = values.platform === "both" ? ["ios", "web"] : values.platform === "ios" || values.platform === "web" ? [values.platform] : [];
  if (platforms.length === 0) throw new UsageError(`--platform must be ios, web or both, not ${values.platform}`);
  if (!/^[\w.-]+$/.test(values.label) || /^\.+$/.test(values.label))
    throw new UsageError("--label may only use letters, digits, dot, dash and underscore, and cannot be only dots");
  const only = [...values.only];
  let full = values.full;
  for (const target of positionals) {
    if (target === "all") full = true;
    else only.push(map.flows.find((flow) => flow.screen === target || flow.screen.slice(3) === target)?.id ?? target);
  }
  const unknown = only.find((id) => !map.flows.some((flow) => flow.id === id));
  if (unknown) throw new UsageError(`Unknown flow "${unknown}". Flows: ${map.flows.map((flow) => flow.id).join(", ")}`);
  return { platforms, label: values.label, full, only, dryRun: values["dry-run"], unattended: values.unattended || Boolean(process.env.CI), base: values.base };
}

class UsageError extends Error {}

const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);

function changedFiles(base: string) {
  try {
    git("rev-parse", "--verify", "--quiet", base);
  } catch {
    throw new UsageError(`Base ${base} does not exist. Fetch it, pass --base <ref>, or use --full or --only.`);
  }
  return [
    ...new Set([...git("diff", "--name-only", `${base}...HEAD`), ...git("diff", "--name-only", "HEAD"), ...git("ls-files", "--others", "--exclude-standard")]),
  ].sort();
}

const TIER_NAMES = { static: "a (static: checks only)", localized: "b (localized)", full: "c (full regression)" } as const;

function printPlan(plan: Plan, context: { scoped: boolean; base: string; changed: number; platforms: Platform[]; label: string }) {
  say("verify plan");
  say(
    context.scoped
      ? `  diff: ${context.changed} changed file(s) against ${context.base}, including uncommitted and untracked files`
      : "  diff: not used, flows chosen by --full, all or --only",
  );
  if (plan.kind === "unmapped") {
    say("  stop: these changed files match no rule in scripts/verify/feature-map.json:");
    for (const file of plan.unmapped) say(`    ${file}`);
    say("  Add each one to the map (an existing area, a new area with its flows, a core rule, or static), then rerun.");
    return;
  }
  say(`  tier: ${TIER_NAMES[plan.tier]}`);
  say("  why:");
  if (plan.reasons.length === 0) say("    no changed files");
  const width = Math.min(60, Math.max(0, ...plan.reasons.map((reason) => reason.file.length)));
  for (const reason of plan.reasons) say(`    ${reason.file.padEnd(width)}  ${reason.rule}`);
  if (plan.unmapped.length > 0) say(`  unmapped (fix the map in a follow-up): ${plan.unmapped.join(", ")}`);
  for (const note of plan.notes) say(`  note: ${note}`);
  say("  will run:");
  say("    checks: npm run typecheck, npm run lint, npm test");
  if (plan.flows.length === 0) say("    flows: none, so the app is not launched");
  else {
    say(`    flows on ${context.platforms.join(" and ")}: ${plan.flows.join(", ")}`);
    say(`    screenshots: artifacts/verify/${context.label}/<platform>/`);
  }
}

const envWithoutAppVars = () => Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("EXPO_PUBLIC_")));

async function timed(steps: Step[], step: Omit<Step, "ok" | "durationMs">, body: () => Promise<boolean | void>) {
  const begun = Date.now();
  say(`  > ${step.platform ? `${step.platform} ` : ""}${step.id}`);
  try {
    const ok = (await body()) !== false;
    steps.push({ ...step, ok, durationMs: Date.now() - begun });
    say(`    ${ok ? "pass" : "FAIL"} ${Math.round((Date.now() - begun) / 1000)}s${!ok && step.log ? `  (log: ${relative(step.log)})` : ""}`);
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    steps.push({ ...step, ok: false, durationMs: Date.now() - begun, error: message });
    say(`    FAIL ${message}`);
    return false;
  }
}

type RunPlan = Extract<Plan, { kind: "run" }>;
type Run = {
  plan: RunPlan;
  platforms: Platform[];
  outDir: string;
  logsDir: string;
  steps: Step[];
  device: { udid: string | null };
};

const ports = {
  metro: Number(process.env.VERIFY_METRO_PORT ?? 8091),
  web: Number(process.env.VERIFY_WEB_PORT ?? 8191),
  convex: Number(process.env.VERIFY_CONVEX_PORT ?? 3290),
};
const node = process.execPath;
const bin = (...parts: string[]) => path.join(root, "node_modules", ...parts);
const webUrl = `http://localhost:${ports.web}`;
const selectedFlows = (plan: RunPlan) => map.flows.filter((entry) => plan.flows.includes(entry.id));

async function runChecks({ steps, logsDir }: Run) {
  say("checks");
  for (const id of ["typecheck", "lint", "test"]) {
    const log = path.join(logsDir, `${id}.log`);
    await timed(steps, { id, kind: "check", log }, async () => (await run(id, "npm", ["run", "--silent", id], { logFile: log, timeoutMs: 15 * 60_000 })) === 0);
  }
}

const appEnv = (): NodeJS.ProcessEnv => ({
  ...envWithoutAppVars(),
  CI: "1",
  EXPO_NO_DOTENV: "1",
  EXPO_NO_TELEMETRY: "1",
  EXPO_NO_GIT_STATUS: "1",
  BROWSER: "none",
  PLAYWRIGHT_BROWSERS_PATH: path.join(cacheDir, "ms-playwright"),
});

function startBundler(name: string, port: number, setting: string, backend: Backend, logsDir: string) {
  requireFreePort(port, setting);
  start(name, node, [bin("expo", "bin", "cli"), "start", "--port", String(port), "--localhost"], {
    logFile: path.join(logsDir, `${name}.log`),
    env: { ...appEnv(), EXPO_PUBLIC_CONVEX_URL: backend.url, EXPO_PUBLIC_DEV_LOGIN: "1" },
  });
}

const bundlerReady = (port: number) =>
  waitFor(
    `Metro on port ${port}`,
    httpOk(`http://localhost:${port}/status`, (body) => body.includes("packager-status:running")),
    120_000,
  );

async function warm(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10 * 60_000) });
  if (!response.ok) throw new Error(`warming ${url} returned ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return response.text();
}

async function runWeb({ plan, outDir, logsDir, steps }: Run, backend: Backend) {
  const shotsDir = path.join(outDir, "web");
  mkdirSync(shotsDir, { recursive: true });
  const installLog = path.join(logsDir, "playwright-install.log");
  const ready = await timed(steps, { id: "web-bundler", kind: "setup", platform: "web", log: path.join(logsDir, "metro-web.log") }, async () => {
    startBundler("metro-web", ports.web, "VERIFY_WEB_PORT", backend, logsDir);
    const installed = await run("playwright-install", node, [bin("@playwright", "test", "cli.js"), "install", "chromium", "--only-shell", "--no-progress"], {
      logFile: installLog,
      env: appEnv(),
      timeoutMs: 10 * 60_000,
    });
    if (installed !== 0) throw new Error(`playwright install exited ${installed}; see ${relative(installLog)}`);
    await bundlerReady(ports.web);
    const script = (await warm(`${webUrl}/`)).match(/<script[^>]+src="([^"]+)"/)?.[1];
    if (script) await warm(new URL(script, webUrl).toString());
  });
  if (ready) {
    const report = path.join(logsDir, "playwright-report.json");
    const log = path.join(logsDir, "web-playwright.log");
    const code = await run("playwright", node, [bin("@playwright", "test", "cli.js"), "test", "-c", path.join(import.meta.dirname, "playwright.config.ts")], {
      logFile: log,
      timeoutMs: 20 * 60_000,
      env: {
        ...appEnv(),
        VERIFY_FLOWS: plan.flows.join(","),
        VERIFY_SHOTS_DIR: shotsDir,
        VERIFY_WEB_URL: webUrl,
        VERIFY_DEV_SECRET: backend.devSecret,
        VERIFY_GROUP_NAME: SEED.groupName,
        VERIFY_SONG_TITLE: SEED.songTitle,
        VERIFY_PLAYWRIGHT_REPORT: report,
        VERIFY_PLAYWRIGHT_OUTPUT: path.join(logsDir, "playwright-output"),
      },
    });
    const results = playwrightResults(report);
    for (const flow of selectedFlows(plan)) {
      const result = results.get(flow.id);
      const screenshot = path.join(shotsDir, `${flow.screen}.png`);
      const ok = result?.ok === true && existsSync(screenshot);
      const durationMs = result?.durationMs ?? 0;
      steps.push({
        id: flow.id,
        kind: "flow",
        platform: "web",
        ok,
        durationMs,
        screenshot: existsSync(screenshot) ? relative(screenshot) : undefined,
        log: relative(log),
        error: ok ? undefined : (result?.error ?? `playwright exited ${code} without a result for this flow`),
      });
      say(`  > web ${flow.id}`);
      say(`    ${ok ? "pass" : "FAIL"} ${Math.round(durationMs / 1000)}s${ok ? "" : `  (log: ${relative(log)})`}`);
    }
    const webFlowsPassed = steps.filter((step) => step.platform === "web" && step.kind === "flow").every((step) => step.ok);
    if (code !== 0 && webFlowsPassed) {
      steps.push({ id: "playwright", kind: "setup", platform: "web", ok: false, durationMs: 0, log: relative(log), error: `playwright exited ${code} although every flow passed` });
      say(`  > web playwright\n    FAIL exited ${code}  (log: ${relative(log)})`);
    }
  }
  await stop("metro-web");
}

async function runIos({ plan, outDir, logsDir, steps, device }: Run, backend: Backend) {
  const shotsDir = path.join(outDir, "ios");
  mkdirSync(shotsDir, { recursive: true });
  const env = appEnv();
  const ready = await timed(steps, { id: "ios-dev-build", kind: "setup", platform: "ios", log: path.join(logsDir, "xcodebuild.log") }, async () => {
    const simulator = resolveDevice(process.env.VERIFY_IOS_DEVICE ?? "iPhone 17");
    device.udid = simulator.udid;
    say(`    simulator ${simulator.name} (${simulator.udid})`);
    bootDevice(simulator);
    pinStatusBar(simulator.udid);
    startBundler("metro-ios", ports.metro, "VERIFY_METRO_PORT", backend, logsDir);
    const build = await ensureBuild({ env, logsDir, log: (line) => say(`    ${line}`) });
    say(`    dev build ${build.cached ? "from cache" : "built"}: ${build.key}`);
    await bundlerReady(ports.metro);
    await warm(`http://localhost:${ports.metro}/.expo/.virtual-metro-entry.bundle?platform=ios&dev=false&minify=false`);
    installFresh(simulator.udid, build.app);
  });
  const udid = device.udid;
  if (!ready || !udid) return;
  const vars = { DEV_SECRET: backend.devSecret, GROUP_NAME: SEED.groupName, SONG_TITLE: SEED.songTitle, METRO_PORT: String(ports.metro) };
  const metroLog = path.join(logsDir, "metro-ios.log");
  const bundlesServed = () => (readFileSync(metroLog, "utf8").match(/iOS Bundled/g) ?? []).length;
  let servedBeforeFirstFlow: number | null = bundlesServed();
  for (const flow of selectedFlows(plan)) {
    const shot = path.join(shotsDir, flow.screen);
    const log = path.join(logsDir, `ios-${flow.id}.log`);
    await timed(steps, { id: flow.id, kind: "flow", platform: "ios", log }, async () => {
      const { code, retried } = await runMaestroFlow({ id: flow.id, udid, shot, vars, env, logFile: log });
      if (retried) say("    Maestro's iOS driver crashed, so the flow ran once more");
      if (servedBeforeFirstFlow !== null && bundlesServed() <= servedBeforeFirstFlow)
        throw new Error(`the app did not load its bundle from Metro on port ${ports.metro}, so it may be running other code; see ${relative(metroLog)}`);
      servedBeforeFirstFlow = null;
      if (code === 124) throw new Error(`maestro timed out after 8 minutes; log: ${relative(log)}`);
      if (code !== 0) throw new Error(`maestro exited ${code}; log: ${relative(log)}`);
      if (!existsSync(`${shot}.png`)) throw new Error(`flow passed but wrote no screenshot at ${relative(shot)}.png`);
      if (flow.mask?.length || flow.iosMaskRegions?.length || flow.iosCrop)
        await finishScreenshot({ udid, png: `${shot}.png`, mask: flow.mask ?? [], regions: flow.iosMaskRegions ?? [], crop: flow.iosCrop, env, logFile: log });
    });
    if (existsSync(`${shot}.png`)) steps[steps.length - 1].screenshot = relative(`${shot}.png`);
  }
}

async function runApp(context: Run) {
  say("app");
  let backend: Backend | undefined;
  await timed(context.steps, { id: "local-backend", kind: "setup", log: path.join(context.logsDir, "convex-backend.log") }, async () => {
    backend = await startBackend({ port: ports.convex, webUrl, logsDir: context.logsDir });
    say(`    Convex ${backend.url}, seeded Group "${SEED.groupName}" for ${SEED.email}`);
  });
  if (!backend) return;
  if (context.platforms.includes("web")) await runWeb(context, backend);
  if (context.platforms.includes("ios")) await runIos(context, backend);
}

function writeSummary(context: Run, label: string, began: Date) {
  const { plan, steps } = context;
  const summary = {
    label,
    ok: steps.length > 0 && steps.every((step) => step.ok),
    startedAt: began.toISOString(),
    durationMs: Date.now() - began.getTime(),
    commit: git("rev-parse", "HEAD")[0],
    tier: plan.tier,
    reasons: plan.reasons,
    unmapped: plan.unmapped,
    notes: plan.notes,
    flows: plan.flows,
    platforms: context.platforms,
    steps,
  };
  mkdirSync(context.outDir, { recursive: true });
  writeFileSync(path.join(context.outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

async function main() {
  const cli = parseCli();
  const scoped = cli.only.length === 0 && !cli.full;
  const changed = scoped ? changedFiles(cli.base) : [];
  const plan = planFor({ changed, map, full: cli.full, only: cli.only, unattended: cli.unattended });
  printPlan(plan, { scoped, base: cli.base, changed: changed.length, platforms: cli.platforms, label: cli.label });
  if (plan.kind === "unmapped") return EXIT_UNMAPPED;
  if (cli.dryRun) return 0;

  const outDir = path.join(root, "artifacts", "verify", cli.label);
  const context: Run = {
    plan,
    platforms: plan.flows.length > 0 ? cli.platforms : [],
    outDir,
    logsDir: path.join(outDir, "logs"),
    steps: [],
    device: { udid: null },
  };
  const began = new Date();

  takeLock();
  const teardown = async () => {
    await stopAll();
    if (context.device.udid) {
      uninstall(context.device.udid);
      clearStatusBar(context.device.udid);
    }
    shutDownIfWeBooted();
    releaseLock();
  };
  for (const [signal, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
    ["SIGHUP", 129],
  ] as const) {
    process.once(signal, () => {
      beginStopping();
      say(`\n${signal}: tearing down`);
      void teardown().finally(() => process.exit(code));
    });
  }
  process.once("exit", () => {
    killAllNow();
    releaseLock();
  });

  try {
    say("setup");
    await reconcile((line) => say(`  ${line}`));
    if (restoreAfterPrebuild()) say("  restored package.json and package-lock.json saved before an interrupted prebuild");
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(context.logsDir, { recursive: true });
    await runChecks(context);
    if (context.platforms.length > 0) await runApp(context);
  } finally {
    const summary = writeSummary(context, cli.label, began);
    say("teardown");
    await teardown();
    say();
    say(
      `${summary.ok ? "verify passed" : "verify FAILED"} in ${Math.round(summary.durationMs / 1000)}s: ${context.steps.filter((step) => step.ok).length}/${context.steps.length} steps`,
    );
    for (const step of context.steps.filter((entry) => !entry.ok))
      say(`  failed: ${step.platform ? `${step.platform} ` : ""}${step.id}${step.error ? `: ${step.error}` : ""}`);
    say(`summary: ${relative(path.join(outDir, "summary.json"))}`);
  }
  return context.steps.every((step) => step.ok) ? 0 : EXIT_FAILED;
}

type PlaywrightSuite = {
  specs?: { title: string; tests: { results: { status: string; duration: number; error?: { message?: string } }[] }[] }[];
  suites?: PlaywrightSuite[];
};

function playwrightResults(report: string) {
  const results = new Map<string, { ok: boolean; durationMs: number; error?: string }>();
  if (!existsSync(report)) return results;
  const visit = (suite: PlaywrightSuite) => {
    for (const spec of suite.specs ?? []) {
      const result = spec.tests[0]?.results.at(-1);
      if (result)
        results.set(spec.title, {
          ok: result.status === "passed",
          durationMs: result.duration,
          error: result.error?.message?.replace(/\u001b\[[0-9;]*m/g, "").split("\n")[0],
        });
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  visit(JSON.parse(readFileSync(report, "utf8")) as PlaywrightSuite);
  return results;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    say(error instanceof Error ? error.message : String(error));
    process.exit(error instanceof UsageError ? EXIT_USAGE : EXIT_FAILED);
  },
);
