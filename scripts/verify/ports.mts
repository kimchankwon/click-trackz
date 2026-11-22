import { mkdirSync } from "node:fs";
import { createServer, type Server } from "node:net";
import os from "node:os";
import path from "node:path";

import { claimFile, describeProcess, listeners, processGroup, releaseFile, root, stop, type Started } from "./processes.mts";

export const sharedPortsDir = path.join(os.homedir(), "Library", "Caches", "click-trackz-verify", "ports");

export type PortNeed = { service: string; setting: string; preferred: number; span: number; explicit: boolean };
export type Reservation = PortNeed & { port: number };
export type Launched = { started: Started; ready: () => Promise<void> };

const NEVER_USED = new Set([8081]);
const CANDIDATES = 100;
const MOVES = 3;
const HOSTS = ["127.0.0.1", "::1"];

type Bound = Server | "taken" | "no-address";

const bind = (port: number, host: string) =>
  new Promise<Bound>((resolve) => {
    const server = createServer((socket) => socket.destroy());
    server.unref();
    server.once("error", (error: NodeJS.ErrnoException) =>
      resolve(error.code === "EADDRNOTAVAIL" || error.code === "EAFNOSUPPORT" ? "no-address" : "taken"),
    );
    server.listen({ port, host, exclusive: true }, () => resolve(server));
  });

const close = (server: Server) => new Promise<void>((resolve) => server.close(() => resolve()));

const span = (first: number, count: number) => Array.from({ length: count }, (_, offset) => first + offset);

const label = (reservation: Pick<Reservation, "port" | "span">) =>
  reservation.span === 1 ? String(reservation.port) : `${reservation.port} to ${reservation.port + reservation.span - 1}`;

function intruderOn(ports: number[], ownGroup: number | null) {
  for (const port of ports)
    for (const pid of listeners(port)) if (ownGroup === null || processGroup(pid) !== ownGroup) return { port, pid };
  return null;
}

const untilReady = ({ started, ready }: Launched) =>
  Promise.race([
    ready(),
    started.exited.then((code) => {
      throw new Error(`${started.name} exited ${code} before it was ready`);
    }),
  ]);

export function portRegistry(dir = sharedPortsDir) {
  const holds = new Map<number, Server[]>();
  const claims = new Set<number>();
  const claimPath = (port: number) => path.join(dir, `${port}.json`);

  async function unhold(port: number) {
    for (const server of holds.get(port) ?? []) await close(server);
    holds.delete(port);
  }

  async function give(port: number) {
    await unhold(port);
    if (claims.delete(port)) releaseFile(claimPath(port));
  }

  async function take(port: number, service: string) {
    if (NEVER_USED.has(port)) return "kept for the default Metro";
    const busy = listeners(port)[0];
    if (busy !== undefined) return `in use by ${describeProcess(busy)}`;
    const claim = claimFile(claimPath(port), { service, worktree: root });
    if (!claim.claimed) return claim.holder ? `reserved by another verify run (pid ${claim.holder.pid})` : "being reserved by another verify run";
    claims.add(port);
    const servers: Server[] = [];
    holds.set(port, servers);
    for (const host of HOSTS) {
      const bound = await bind(port, host);
      if (bound === "taken") return `bound by another process on ${host}`;
      if (bound !== "no-address") servers.push(bound);
    }
    return null;
  }

  async function reserve(need: PortNeed, log: (line: string) => void): Promise<Reservation> {
    mkdirSync(dir, { recursive: true });
    let firstRefusal: string | null = null;
    for (let candidate = 0; candidate < (need.explicit ? 1 : CANDIDATES); candidate++) {
      const port = need.preferred + candidate * need.span;
      let refusal: string | null = null;
      for (const each of span(port, need.span)) {
        const reason = await take(each, need.service);
        if (reason) {
          refusal = `port ${each} is ${reason}`;
          break;
        }
      }
      if (refusal === null) {
        if (firstRefusal) log(`${need.service} uses ${label({ port, span: need.span })}: ${firstRefusal}`);
        return { ...need, port };
      }
      for (const each of span(port, need.span)) await give(each);
      firstRefusal ??= refusal;
      if (need.explicit) throw new Error(`${need.service}: ${refusal}. Free it or change ${need.setting}.`);
    }
    throw new Error(`${need.service}: no free port from ${need.preferred} in ${CANDIDATES} tries (first: ${firstRefusal}). Free one or set ${need.setting}.`);
  }

  async function serve(first: Reservation, launch: (port: number) => Launched, log: (line: string) => void): Promise<Reservation> {
    let current = first;
    for (let move = 0; ; move++) {
      const ports = span(current.port, current.span);
      for (const port of ports) await unhold(port);
      let intruder = intruderOn(ports, null);
      if (!intruder) {
        const launched = launch(current.port);
        const ownGroup = launched.started.pid;
        try {
          await untilReady(launched);
        } catch (error) {
          intruder = intruderOn(ports, ownGroup);
          if (!intruder) throw error;
        }
        intruder ??= intruderOn(ports, ownGroup);
        if (!intruder) return current;
        await stop(launched.started.name);
      }
      const taken = `${current.service}: port ${intruder.port} was taken by ${describeProcess(intruder.pid)} after verify reserved it`;
      if (current.explicit) throw new Error(`${taken}. Free it or change ${current.setting}.`);
      if (move === MOVES) throw new Error(`${taken}, and ${MOVES} other ports were taken the same way`);
      for (const port of ports) await give(port);
      current = await reserve({ ...current, preferred: current.port + current.span }, () => undefined);
      log(`${taken}, so it moved to ${label(current)}`);
    }
  }

  function releaseAll() {
    for (const servers of holds.values()) for (const server of servers) server.close();
    holds.clear();
    for (const port of claims) releaseFile(claimPath(port));
    claims.clear();
  }

  return { reserve, serve, releaseAll };
}

export type PortRegistry = ReturnType<typeof portRegistry>;

export const describePorts = (reservations: Reservation[]) => reservations.map((entry) => `${entry.service} ${label(entry)}`).join(", ");
