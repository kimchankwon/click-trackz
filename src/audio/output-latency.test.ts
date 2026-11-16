import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ present: true, reads: 0, ms: 28.5 as number | (() => number) }));

vi.mock("expo", () => ({
  requireOptionalNativeModule: () =>
    native.present
      ? {
          outputLatencyMs: () => {
            native.reads += 1;
            return typeof native.ms === "function" ? native.ms() : native.ms;
          },
        }
      : null,
}));

const load = async () => {
  vi.resetModules();
  return (await import("./output-latency")).reportedOutputLatencyMs;
};

describe("reportedOutputLatencyMs on native", () => {
  let clock = 0;

  beforeEach(() => {
    native.present = true;
    native.reads = 0;
    native.ms = 28.5;
    clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports the audio session latency", async () => {
    const reported = await load();
    expect(reported()).toBe(28.5);
  });

  it("reads the session at most once a second", async () => {
    const reported = await load();
    reported();
    clock = 999;
    native.ms = 160;
    expect(reported()).toBe(28.5);
    clock = 1_000;
    expect(reported()).toBe(160);
    expect(native.reads).toBe(2);
  });

  it("reports nothing when the build has no module", async () => {
    native.present = false;
    const reported = await load();
    expect(reported()).toBeNull();
  });

  it("reports nothing when the first reading fails", async () => {
    native.ms = () => {
      throw new Error("session gone");
    };
    const reported = await load();
    expect(reported()).toBeNull();
  });

  it("keeps the last good reading through a failed or nonsense one", async () => {
    const reported = await load();
    expect(reported()).toBe(28.5);
    clock = 1_000;
    native.ms = () => {
      throw new Error("session gone");
    };
    expect(reported()).toBe(28.5);
    clock = 2_000;
    native.ms = Number.NaN;
    expect(reported()).toBe(28.5);
    clock = 3_000;
    native.ms = 160;
    expect(reported()).toBe(160);
  });
});
