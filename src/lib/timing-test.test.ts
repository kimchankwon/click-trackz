import { describe, expect, it } from "vitest";

import { beatPhase, markGrowth, nudgeFromTaps, offsetFromBeat } from "./timing-test";

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

  it("adds the middle tap offset to the nudge being tested once there are enough taps", () => {
    expect(nudgeFromTaps(0, [100, 120])).toBeNull();
    expect(nudgeFromTaps(0, [100, 120, 140, 900])).toBe(130);
    expect(nudgeFromTaps(150, [-20, -10, 0, 10, 20])).toBe(150);
  });

  it("grows a mark when the line reaches it and lets it shrink back over a quarter beat", () => {
    expect(markGrowth(-1, 0.5)).toBe(0);
    expect(markGrowth(0.4, 0.5)).toBe(0);
    expect(markGrowth(0.5, 0.5)).toBe(1);
    expect(markGrowth(0.625, 0.5)).toBeCloseTo(0.5);
    expect(markGrowth(0.8, 0.5)).toBe(0);
  });
});
