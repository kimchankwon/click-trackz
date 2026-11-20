import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { cacheDir, root, run, stateDir } from "./processes.mts";

export const BUNDLE_ID = "com.kimchankwon.cuetracker";

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const simctl = (...args: string[]) => execFileSync("xcrun", ["simctl", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

type Device = { udid: string; name: string; state: string };

export function resolveDevice(wanted: string): Device {
  const listing = JSON.parse(simctl("list", "devices", "available", "-j")) as { devices: Record<string, Device[]> };
  const devices = Object.values(listing.devices).flat();
  const matches = devices.filter((device) => device.udid === wanted || device.name === wanted);
  if (matches.length === 0) throw new Error(`No available simulator named or with UDID "${wanted}". Set VERIFY_IOS_DEVICE.`);
  if (matches.length === 1) return matches[0];
  const booted = matches.filter((device) => device.state === "Booted");
  if (booted.length === 1) return booted[0];
  throw new Error(`Several simulators match "${wanted}": ${matches.map((device) => device.udid).join(", ")}. Set VERIFY_IOS_DEVICE to one UDID.`);
}

const bootedMarker = path.join(stateDir, "booted-simulator");

export function bootDevice(device: Device) {
  if (device.state !== "Booted") {
    simctl("boot", device.udid);
    writeFileSync(bootedMarker, device.udid);
  }
  simctl("bootstatus", device.udid, "-b");
}

export function shutDownIfWeBooted() {
  if (!existsSync(bootedMarker)) return;
  const udid = readFileSync(bootedMarker, "utf8").trim();
  try {
    simctl("shutdown", udid);
  } catch {}
  rmSync(bootedMarker, { force: true });
}

const fingerprint = () => {
  const output = execFileSync(
    process.execPath,
    [path.join(root, "node_modules", "@expo", "fingerprint", "bin", "cli.js"), "fingerprint:generate", "--platform", "ios"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return (JSON.parse(output) as { hash: string }).hash;
};

const prebuildBackup = path.join(stateDir, "prebuild-backup");
const touchedByPrebuild = ["package.json", "package-lock.json"];

export function restoreAfterPrebuild() {
  if (!existsSync(prebuildBackup)) return false;
  for (const file of touchedByPrebuild) {
    const saved = path.join(prebuildBackup, file);
    if (existsSync(saved)) copyFileSync(saved, path.join(root, file));
  }
  rmSync(prebuildBackup, { recursive: true, force: true });
  return true;
}

export type Build = { app: string; key: string; cached: boolean };

export async function ensureBuild({ env, logsDir, log }: { env: NodeJS.ProcessEnv; logsDir: string; log: (line: string) => void }): Promise<Build> {
  const key = fingerprint();
  const keyed = path.join(cacheDir, "ios", key);
  const cachedApp = existsSync(keyed) ? readdirSync(keyed).find((entry) => entry.endsWith(".app")) : undefined;
  if (cachedApp) return { app: path.join(keyed, cachedApp), key, cached: true };

  log(`no cached dev build for ${key}; building locally (prebuild + xcodebuild)`);
  mkdirSync(prebuildBackup, { recursive: true });
  for (const file of touchedByPrebuild) copyFileSync(path.join(root, file), path.join(prebuildBackup, file));
  const prebuild = await run(
    "expo-prebuild",
    process.execPath,
    [path.join(root, "node_modules", "expo", "bin", "cli"), "prebuild", "--platform", "ios", "--clean"],
    {
      logFile: path.join(logsDir, "expo-prebuild.log"),
      env: { ...env, EXPO_NO_GIT_STATUS: "1" },
      timeoutMs: 15 * 60_000,
    },
  );
  restoreAfterPrebuild();
  if (prebuild !== 0) throw new Error(`expo prebuild exited ${prebuild}; see ${path.join(logsDir, "expo-prebuild.log")}`);

  const iosDir = path.join(root, "ios");
  const workspace = readdirSync(iosDir).find((entry) => entry.endsWith(".xcworkspace"));
  if (!workspace) throw new Error("expo prebuild did not create an .xcworkspace in ios/");
  const scheme = workspace.replace(/\.xcworkspace$/, "");
  const derivedData = path.join(stateDir, "DerivedData");
  const products = path.join(derivedData, "Build", "Products", "Debug-iphonesimulator");
  rmSync(products, { recursive: true, force: true });
  const xcodebuild = await run(
    "xcodebuild",
    "xcodebuild",
    [
      "-workspace",
      path.join(iosDir, workspace),
      "-scheme",
      scheme,
      "-configuration",
      "Debug",
      "-sdk",
      "iphonesimulator",
      "-destination",
      "generic/platform=iOS Simulator",
      "-derivedDataPath",
      derivedData,
      "build",
    ],
    { logFile: path.join(logsDir, "xcodebuild.log"), env, timeoutMs: 60 * 60_000 },
  );
  if (xcodebuild !== 0) throw new Error(`xcodebuild exited ${xcodebuild}; see ${path.join(logsDir, "xcodebuild.log")}`);
  const built = readdirSync(products).find((entry) => entry.endsWith(".app"));
  if (!built) throw new Error(`xcodebuild produced no .app in ${products}`);
  mkdirSync(path.dirname(keyed), { recursive: true });
  for (const entry of readdirSync(path.dirname(keyed))) {
    const owner = Number(entry.match(/\.partial-(\d+)$/)?.[1]);
    if (owner && !isAlive(owner)) rmSync(path.join(path.dirname(keyed), entry), { recursive: true, force: true });
  }
  const staging = `${keyed}.partial-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  cpSync(path.join(products, built), path.join(staging, built), { recursive: true, verbatimSymlinks: true });
  rmSync(keyed, { recursive: true, force: true });
  renameSync(staging, keyed);
  return { app: path.join(keyed, built), key, cached: false };
}

export const pinStatusBar = (udid: string) =>
  simctl(
    "status_bar",
    udid,
    "override",
    "--time",
    "9:41",
    "--dataNetwork",
    "wifi",
    "--wifiMode",
    "active",
    "--wifiBars",
    "3",
    "--batteryState",
    "charged",
    "--batteryLevel",
    "100",
  );

export function clearStatusBar(udid: string) {
  try {
    simctl("status_bar", udid, "clear");
  } catch {
    return;
  }
}

export function uninstall(udid: string) {
  try {
    simctl("terminate", udid, BUNDLE_ID);
  } catch {}
  try {
    simctl("uninstall", udid, BUNDLE_ID);
  } catch {}
}

export function installFresh(udid: string, app: string) {
  uninstall(udid);
  simctl("install", udid, app);
}

export function maestroEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const javaHome = "/opt/homebrew/opt/openjdk";
  return {
    ...env,
    JAVA_HOME: javaHome,
    PATH: `${javaHome}/bin:${path.join(os.homedir(), ".maestro", "bin")}:${env.PATH ?? ""}`,
    MAESTRO_CLI_NO_ANALYTICS: "1",
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true",
    MAESTRO_DRIVER_STARTUP_TIMEOUT: "240000",
  };
}

export async function runMaestroFlow({
  id,
  udid,
  shot,
  vars,
  env,
  logFile,
}: {
  id: string;
  udid: string;
  shot: string;
  vars: Record<string, string>;
  env: NodeJS.ProcessEnv;
  logFile: string;
}) {
  const flow = path.join(import.meta.dirname, "maestro", `${id}.yaml`);
  const outputDir = path.join(stateDir, "maestro", id);
  const args = [
    "--device",
    udid,
    "test",
    flow,
    "--test-output-dir",
    outputDir,
    "-e",
    `SHOT=${shot}`,
    ...Object.entries(vars).flatMap(([name, value]) => ["-e", `${name}=${value}`]),
  ];
  const attempt = () => {
    rmSync(outputDir, { recursive: true, force: true });
    const from = existsSync(logFile) ? statSync(logFile).size : 0;
    const driverCrashed = () => existsSync(logFile) && DRIVER_CRASH.test(readFileSync(logFile, "utf8").slice(from));
    return run(`maestro-${id}`, "maestro", args, { logFile, env: maestroEnv(env), timeoutMs: 8 * 60_000, abortWhen: driverCrashed }).then((code) => ({
      code,
      driverCrashed: code !== 0 && driverCrashed(),
    }));
  };
  const first = await attempt();
  if (!first.driverCrashed) return { code: first.code, retried: false };
  appendFileSync(logFile, "\nverify: Maestro's iOS driver crashed, so the flow runs once more\n");
  const second = await attempt();
  return { code: second.code, retried: true };
}

const DRIVER_CRASH = /Exception in thread "main"[^\n]*(UnknownFailure|XCTestDriver)/;
