import { execFileSync, spawn, type SpawnOptions } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "../..");
export const stateDir = path.join(root, ".verify");
export const cacheDir = process.env.VERIFY_CACHE_DIR ?? path.join(os.homedir(), "Library", "Caches", "click-trackz-verify");
const pidDir = path.join(stateDir, "pids");
const lockFile = path.join(stateDir, "verify.lock");

type Tracked = { name: string; pid: number; started: string; command: string };

const startedAt = (pid: number) => {
  try {
    return execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

const isSameProcess = (record: { pid: number; started: string }) => startedAt(record.pid) === record.started;

const groupMembers = (pgid: number) =>
  execFileSync("ps", ["-axo", "pid=,pgid="], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter(([, group]) => group === pgid)
    .map(([pid]) => pid);

const signalGroup = (pgid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-pgid, signal);
  } catch {
    return;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function stopGroup(record: Tracked) {
  const leader = startedAt(record.pid);
  if (leader !== null && leader !== record.started) return false;
  const hadMembers = groupMembers(record.pid).length > 0;
  await reapGroup(record.pid);
  return hadMembers;
}

async function reapGroup(pgid: number) {
  if (groupMembers(pgid).length === 0) return;
  signalGroup(pgid, "SIGTERM");
  for (let waited = 0; waited < 5000 && groupMembers(pgid).length > 0; waited += 200) await sleep(200);
  if (groupMembers(pgid).length > 0) signalGroup(pgid, "SIGKILL");
}

const pidFile = (name: string) => path.join(pidDir, `${name}.json`);

const records = (): Tracked[] =>
  existsSync(pidDir)
    ? readdirSync(pidDir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => JSON.parse(readFileSync(path.join(pidDir, file), "utf8")) as Tracked)
    : [];

export async function stop(name: string) {
  const file = pidFile(name);
  if (!existsSync(file)) return;
  await stopGroup(JSON.parse(readFileSync(file, "utf8")) as Tracked);
  rmSync(file, { force: true });
}

export async function stopAll() {
  for (const record of records()) await stop(record.name);
}

export function killAllNow() {
  for (const record of records()) {
    if (isSameProcess(record)) signalGroup(record.pid, "SIGKILL");
    rmSync(pidFile(record.name), { force: true });
  }
}

export async function reconcile(log: (line: string) => void) {
  for (const record of records()) {
    const stopped = await stopGroup(record);
    log(stopped ? `stopped leftover ${record.name} (pid ${record.pid}) from an earlier run` : `cleared stale pid file for ${record.name}`);
    rmSync(pidFile(record.name), { force: true });
  }
}

type Lock = { pid: number; started: string };

const lockText = () => {
  try {
    return readFileSync(lockFile, "utf8");
  } catch {
    return "";
  }
};

const parseLock = (text: string): Lock | null => {
  try {
    return JSON.parse(text) as Lock;
  } catch {
    return null;
  }
};

const claimLock = () => {
  try {
    writeFileSync(lockFile, JSON.stringify({ pid: process.pid, started: startedAt(process.pid) }), { flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
};

export function takeLock() {
  mkdirSync(stateDir, { recursive: true });
  if (claimLock()) return;
  const heldText = lockText();
  const held = parseLock(heldText);
  if (held && isSameProcess(held)) throw new Error(`Another verify run is active (pid ${held.pid}). Stop it first.`);
  const stale = `${lockFile}.stale-${process.pid}`;
  try {
    renameSync(lockFile, stale);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (existsSync(stale)) {
    if (readFileSync(stale, "utf8") !== heldText) {
      renameSync(stale, lockFile);
      throw new Error("Another verify run took the lock at the same moment. Stop it first.");
    }
    rmSync(stale, { force: true });
  }
  if (!claimLock()) throw new Error("Another verify run took the lock at the same moment. Stop it first.");
}

export const releaseLock = () => {
  if (parseLock(lockText())?.pid === process.pid) rmSync(lockFile, { force: true });
};

export function listener(port: number) {
  try {
    const pids = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).trim();
    if (!pids) return null;
    const pid = Number(pids.split("\n")[0]);
    const command = execFileSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" }).trim();
    return { pid, command };
  } catch {
    return null;
  }
}

export function requireFreePort(port: number, setting: string) {
  const taken = listener(port);
  if (taken)
    throw new Error(`Port ${port} is in use by pid ${taken.pid} (${taken.command.slice(0, 120)}), which verify did not start. Free it or set ${setting}.`);
}

let stopping = false;

export const beginStopping = () => {
  stopping = true;
};

export type Started = { name: string; pid: number; exited: Promise<number> };

export function start(name: string, command: string, args: string[], options: { logFile: string; env?: NodeJS.ProcessEnv; cwd?: string }): Started {
  if (stopping) throw new Error(`not starting ${name}: verify is stopping`);
  mkdirSync(pidDir, { recursive: true });
  mkdirSync(path.dirname(options.logFile), { recursive: true });
  const out = openSync(options.logFile, "a");
  const spawnOptions: SpawnOptions = { cwd: options.cwd ?? root, env: options.env ?? process.env, detached: true, stdio: ["ignore", out, out] };
  const child = spawn(command, args, spawnOptions);
  const exited = new Promise<number>((resolve) => {
    child.on("error", () => resolve(127));
    child.on("exit", (code, signal) => {
      const reaped = child.pid === undefined ? Promise.resolve() : reapGroup(child.pid);
      void reaped.finally(() => {
        rmSync(pidFile(name), { force: true });
        resolve(code ?? (signal ? 128 : 1));
      });
    });
  });
  if (child.pid === undefined) throw new Error(`Could not start ${name}: ${command}`);
  const pid = child.pid;
  writeFileSync(pidFile(name), JSON.stringify({ name, pid, started: startedAt(pid), command: [command, ...args].join(" ") }));
  return { name, pid, exited };
}

export async function run(
  name: string,
  command: string,
  args: string[],
  options: { logFile: string; env?: NodeJS.ProcessEnv; cwd?: string; timeoutMs: number },
) {
  const started = start(name, command, args, options);
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<number>((resolve) => {
    timer = setTimeout(() => void stop(name).then(() => resolve(124)), options.timeoutMs);
  });
  const code = await Promise.race([started.exited, timedOut]);
  clearTimeout(timer);
  return code;
}

export async function waitFor(what: string, check: () => Promise<boolean>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check().catch(() => false)) return;
    await sleep(500);
  }
  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for ${what}`);
}

export const httpOk =
  (url: string, accept: (body: string) => boolean = () => true) =>
  async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return response.ok && accept(await response.text());
  };
