import { describe, expect, it } from "vitest";

import { drawLeadMs, frameMsOf, shownTimeMs } from "./frame-lead";

const frames = (count: number, gapMs: number) => Array.from({ length: count }, () => gapMs);

describe("frameMsOf", () => {
  it("reads the frame time of a 120 Hz screen and of a 60 Hz one", () => {
    expect(frameMsOf(frames(15, 8.33))).toBeCloseTo(8.33);
    expect(frameMsOf(frames(15, 16.67))).toBeCloseTo(16.67);
  });

  it("is not thrown by a few dropped frames", () => {
    expect(frameMsOf([...frames(11, 8.33), 16.67, 25, 33.3, 16.67])).toBeCloseTo(8.33);
  });

  it("ignores gaps no screen draws at, such as a stall or two callbacks in one frame", () => {
    expect(frameMsOf([0.2, 900, ...frames(5, 16.67)])).toBeCloseTo(16.67);
  });

  it("assumes 60 Hz until it has a usable gap", () => {
    expect(frameMsOf([])).toBeCloseTo(1000 / 60);
    expect(frameMsOf([0, 1200])).toBeCloseTo(1000 / 60);
  });
});

describe("drawLeadMs", () => {
  it("draws one and a half frames ahead, so a slower screen leads by more", () => {
    expect(drawLeadMs(frames(15, 8.33))).toBeCloseTo(12.5, 1);
    expect(drawLeadMs(frames(15, 16.67))).toBeCloseTo(25, 1);
  });
});

describe("shownTimeMs", () => {
  it("runs ahead of the clock by the lead", () => {
    expect(shownTimeMs(-Infinity, 976, 25)).toBe(1001);
  });

  it("holds instead of stepping back over a beat when the lead shrinks, then moves on", () => {
    const beatAt = 1000;
    const first = shownTimeMs(-Infinity, 976, 25);
    const second = shownTimeMs(first, 984.33, 12.5);
    const third = shownTimeMs(second, 992.66, 12.5);
    expect(first).toBeGreaterThan(beatAt);
    expect(second).toBe(first);
    expect(third).toBeCloseTo(1005.16);
  });

  it("holds through a small backward correction of the clock", () => {
    expect(shownTimeMs(1001, 973, 25)).toBe(1001);
  });
});
