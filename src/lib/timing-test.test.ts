import { describe, expect, it } from "vitest";

import { beatPhase, markGrowth, nudgeFromSteps, offsetFromBeat, steadyOffset } from "./timing-test";

describe("timing test", () => {
  it("sweeps from the left edge half a beat early to the right edge half a beat late, every beat", () => {
    expect(beatPhase(400, 1_000, 1_000)).toBe(-1);
    expect(beatPhase(500, 1_000, 1_000)).toBe(0);
    expect(beatPhase(1_000, 1_000, 1_000)).toBe(0.5);
    expect(beatPhase(1_250, 1_000, 1_000)).toBe(0.75);
    expect(beatPhase(3_000, 1_000, 1_000)).toBe(0.5);
  });

  it("measures a tap against the nearest beat, after the first beats", () => {
    expect(offsetFromBeat(1_100, 1_000, 1_000)).toBeNull();
    expect(offsetFromBeat(3_120, 1_000, 1_000)).toBe(120);
    expect(offsetFromBeat(3_950, 1_000, 1_000)).toBe(-50);
  });

  it("finds a steady tap offset once there are enough taps, ignoring stray ones", () => {
    expect(steadyOffset([40, 42, 41], 1_000)).toBeNull();
    expect(steadyOffset([40, 45, 38, 42, 300, 41], 1_000)).toBe(41);
    expect(steadyOffset([0, 300, 50, 400, 120, 520], 1_000)).toBeNull();
  });

  it("keeps taps near half a beat together when some count against the next beat", () => {
    expect(steadyOffset([480, 490, -495, 485, -490, 495], 1_000)).toBe(492.5);
  });

  it("removes the tapper's own lean by comparing the built-in speaker with the Bluetooth output", () => {
    const builtIn = { offsetsMs: [40, 42, 41, 39, 43, 41], nudgeMs: 0, intervalMs: 1_000 };
    const bluetooth = { offsetsMs: [240, 242, 241, 239, 243, 241], nudgeMs: 0, intervalMs: 1_000 };
    expect(nudgeFromSteps(builtIn, bluetooth, 0)).toBe(200);
    expect(nudgeFromSteps(builtIn, bluetooth, 12)).toBe(212);
  });

  it("counts the nudge each step was played with, so a step played early still measures the same output", () => {
    const builtIn = { offsetsMs: [-60, -58, -59, -61, -57, -59], nudgeMs: 100, intervalMs: 1_000 };
    const bluetooth = { offsetsMs: [40, 42, 41, 39, 43, 41], nudgeMs: 200, intervalMs: 1_000 };
    expect(nudgeFromSteps(builtIn, bluetooth, 0)).toBe(200);
  });

  it("refuses to guess when either step has too few or too scattered taps", () => {
    const steady = { offsetsMs: [40, 42, 41, 39, 43, 41], nudgeMs: 0, intervalMs: 1_000 };
    expect(nudgeFromSteps(steady, { offsetsMs: [200, 210, 205], nudgeMs: 0, intervalMs: 1_000 }, 0)).toBeNull();
    expect(nudgeFromSteps({ offsetsMs: [0, 300, 50, 400, 120, 520], nudgeMs: 0, intervalMs: 1_000 }, steady, 0)).toBeNull();
  });

  it("grows a mark when the line reaches it and lets it shrink back over a quarter beat", () => {
    expect(markGrowth(-1, 0.5)).toBe(0);
    expect(markGrowth(0.4, 0.5)).toBe(0);
    expect(markGrowth(0.5, 0.5)).toBe(1);
    expect(markGrowth(0.625, 0.5)).toBeCloseTo(0.5);
    expect(markGrowth(0.8, 0.5)).toBe(0);
  });
});
