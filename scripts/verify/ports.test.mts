import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { portRegistry, type PortNeed, type PortRegistry } from "./ports.mts";
import { claimFile, processGroup } from "./processes.mts";

const listenOn = (port: number) =>
  new Promise<Server>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ port, host: "127.0.0.1" }, () => resolve(server));
  });

const closeServer = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

const freeBase = async (count: number) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    const base = 41000 + Math.floor(Math.random() * 20000);
    const servers: Server[] = [];
    try {
      for (let offset = 0; offset < count; offset++) servers.push(await listenOn(base + offset));
      return base;
    } catch {
      continue;
    } finally {
      for (const server of servers) await closeServer(server);
    }
  }
  throw new Error("no free test ports");
};

const need = (preferred: number, overrides: Partial<PortNeed> = {}): PortNeed => ({
  service: "Test",
  setting: "VERIFY_TEST_PORT",
  preferred,
  span: 1,
  explicit: false,
  ...overrides,
});

const startedOf = (pid: number) => execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" }).trim();
const quiet = () => undefined;
const never = new Promise<number>(() => undefined);

describe("portRegistry", () => {
  let dir: string;
  let registry: PortRegistry;
  const extra: Server[] = [];

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "verify-ports-"));
    registry = portRegistry(dir);
  });

  afterEach(async () => {
    registry.releaseAll();
    for (const server of extra.splice(0)) await closeServer(server);
    rmSync(dir, { recursive: true, force: true });
  });

  it("holds the preferred port so nothing else can bind it until the service starts", async () => {
    const base = await freeBase(1);
    expect(await registry.reserve(need(base), quiet)).toMatchObject({ port: base });
    await expect(listenOn(base)).rejects.toMatchObject({ code: "EADDRINUSE" });
    expect(JSON.parse(readFileSync(path.join(dir, `${base}.json`), "utf8"))).toMatchObject({ pid: process.pid, service: "Test" });
  });

  it("moves past a port another process listens on and says why", async () => {
    const base = await freeBase(3);
    extra.push(await listenOn(base));
    const lines: string[] = [];
    const reservation = await registry.reserve(need(base), (line) => lines.push(line));
    expect(reservation.port).toBe(base + 1);
    expect(lines.join("\n")).toContain(`port ${base} is`);
  });

  it("keeps a span together, stepping by the span", async () => {
    const base = await freeBase(4);
    extra.push(await listenOn(base + 1));
    expect(await registry.reserve(need(base, { span: 2 }), quiet)).toMatchObject({ port: base + 2 });
  });

  it("skips a port another live verify run has claimed", async () => {
    const base = await freeBase(2);
    writeFileSync(path.join(dir, `${base}.json`), JSON.stringify({ pid: process.ppid, started: startedOf(process.ppid) }));
    expect(await registry.reserve(need(base), quiet)).toMatchObject({ port: base + 1 });
  });

  it("takes over a claim left by a run that has exited", async () => {
    const base = await freeBase(1);
    writeFileSync(path.join(dir, `${base}.json`), JSON.stringify({ pid: spawnSync("true").pid, started: "never" }));
    expect(await registry.reserve(need(base), quiet)).toMatchObject({ port: base });
  });

  it("fails on a taken port that was set explicitly, naming the setting", async () => {
    const base = await freeBase(1);
    extra.push(await listenOn(base));
    await expect(registry.reserve(need(base, { explicit: true }), quiet)).rejects.toThrow(/VERIFY_TEST_PORT/);
  });

  it("never picks 8081", async () => {
    const reservation = await registry.reserve(need(8081), quiet).catch(() => null);
    expect(reservation?.port).not.toBe(8081);
  });

  it("releases its claims so the next run can reserve the same ports", async () => {
    const base = await freeBase(1);
    await registry.reserve(need(base), quiet);
    registry.releaseAll();
    const next = portRegistry(dir);
    expect(await next.reserve(need(base), quiet)).toMatchObject({ port: base });
    next.releaseAll();
  });

  it("starts on the reserved port when the listener belongs to the started process group", async () => {
    const base = await freeBase(1);
    const reservation = await registry.reserve(need(base), quiet);
    const ownGroup = processGroup(process.pid) ?? process.pid;
    const served = await registry.serve(
      reservation,
      (port) => {
        const ready = listenOn(port).then((server) => {
          extra.push(server);
        });
        return { started: { name: "test-service", pid: ownGroup, exited: never }, ready: () => ready };
      },
      quiet,
    );
    expect(served.port).toBe(base);
  });

  it("moves to a fresh port when another process owns the listener after start", async () => {
    const base = await freeBase(3);
    const reservation = await registry.reserve(need(base), quiet);
    const ownGroup = processGroup(process.pid) ?? process.pid;
    const lines: string[] = [];
    let launches = 0;
    const served = await registry.serve(
      reservation,
      (port) => {
        launches++;
        const ready = listenOn(port).then((server) => {
          extra.push(server);
        });
        const pid = launches === 1 ? 1 : ownGroup;
        return { started: { name: "test-service", pid, exited: never }, ready: () => ready };
      },
      (line) => lines.push(line),
    );
    expect(served.port).toBe(base + 1);
    expect(lines.join("\n")).toContain(`moved to ${base + 1}`);
  });

  it("does not move an explicitly set port that was taken", async () => {
    const base = await freeBase(2);
    const reservation = await registry.reserve(need(base, { explicit: true }), quiet);
    await expect(
      registry.serve(
        reservation,
        (port) => {
          const intruder = listenOn(port).then((server) => {
            extra.push(server);
          });
          return { started: { name: "test-service", pid: 1, exited: never }, ready: () => intruder };
        },
        quiet,
      ),
    ).rejects.toThrow(/VERIFY_TEST_PORT/);
  });

  it("passes through a start failure that is not about the port", async () => {
    const base = await freeBase(1);
    const reservation = await registry.reserve(need(base), quiet);
    await expect(
      registry.serve(reservation, () => ({ started: { name: "test-service", pid: 1, exited: Promise.resolve(7) }, ready: () => never.then(() => undefined) }), quiet),
    ).rejects.toThrow("test-service exited 7 before it was ready");
  });
});

describe("claimFile", () => {
  it("refuses a claim held by a live process and reports the holder", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "verify-claim-"));
    const file = path.join(dir, "held.json");
    writeFileSync(file, JSON.stringify({ pid: process.ppid, started: startedOf(process.ppid) }));
    expect(claimFile(file)).toEqual({ claimed: false, holder: expect.objectContaining({ pid: process.ppid }) });
    rmSync(dir, { recursive: true, force: true });
  });

  it("replaces a claim left by a process that is gone", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "verify-claim-"));
    const file = path.join(dir, "stale.json");
    writeFileSync(file, JSON.stringify({ pid: 999_999, started: "long ago" }));
    expect(claimFile(file)).toEqual({ claimed: true });
    expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({ pid: process.pid });
    expect(existsSync(`${file}.break`)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("leaves a stale claim alone while another live run is replacing it", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "verify-claim-"));
    const file = path.join(dir, "stale.json");
    const stale = JSON.stringify({ pid: 999_999, started: "long ago" });
    writeFileSync(file, stale);
    writeFileSync(`${file}.break`, JSON.stringify({ pid: process.ppid, started: startedOf(process.ppid) }));
    expect(claimFile(file)).toEqual({ claimed: false, holder: null });
    expect(readFileSync(file, "utf8")).toBe(stale);
    expect(existsSync(`${file}.break`)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("clears a replacement left by a run that died, so the next claim can go ahead", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "verify-claim-"));
    const file = path.join(dir, "stale.json");
    writeFileSync(file, JSON.stringify({ pid: 999_999, started: "long ago" }));
    writeFileSync(`${file}.break`, JSON.stringify({ pid: 999_998, started: "long ago" }));
    expect(claimFile(file)).toEqual({ claimed: false, holder: null });
    expect(existsSync(`${file}.break`)).toBe(false);
    expect(claimFile(file)).toEqual({ claimed: true });
    rmSync(dir, { recursive: true, force: true });
  });
});
