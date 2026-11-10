import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioContext } from "react-native-audio-api";

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

const context = {} as AudioContext;

const load = async () => {
  vi.resetModules();
  return (await import("./output-latency")).outputLatencyMs;
};

describe("outputLatencyMs on native", () => {
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
    const outputLatencyMs = await load();
    expect(outputLatencyMs(context)).toBe(28.5);
  });

  it("reads the session at most once a second", async () => {
    const outputLatencyMs = await load();
    outputLatencyMs(context);
    clock = 999;
    native.ms = 160;
    expect(outputLatencyMs(context)).toBe(28.5);
    clock = 1_000;
    expect(outputLatencyMs(context)).toBe(160);
    expect(native.reads).toBe(2);
  });

  it("falls back to none when the build has no module", async () => {
    native.present = false;
    const outputLatencyMs = await load();
    expect(outputLatencyMs(context)).toBe(0);
  });

  it("ignores a failed or nonsense reading", async () => {
    native.ms = () => {
      throw new Error("session gone");
    };
    const outputLatencyMs = await load();
    expect(outputLatencyMs(context)).toBe(0);
    clock = 1_000;
    native.ms = Number.NaN;
    expect(outputLatencyMs(context)).toBe(0);
  });
});
