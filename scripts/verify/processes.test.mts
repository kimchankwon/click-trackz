import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { start, stop } from "./processes.mts";

const groupAlive = (pgid: number) =>
  execFileSync("ps", ["-axo", "pgid="], { encoding: "utf8" })
    .split("\n")
    .some((line) => Number(line.trim()) === pgid);

describe("stop", () => {
  it("returns only once a group that ignores SIGTERM is gone", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "verify-stop-"));
    const started = start("stop-test", "bash", ["-c", "trap '' TERM; sleep 60 & wait"], { logFile: path.join(dir, "stop.log") });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(groupAlive(started.pid)).toBe(true);
    await stop("stop-test");
    expect(groupAlive(started.pid)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  }, 20_000);
});
