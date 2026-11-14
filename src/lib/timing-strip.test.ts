import { describe, expect, it } from "vitest";

import { earlyLateText, middleOf, stripPosition, stripRangeMs } from "./timing-strip";

describe("timing strip", () => {
  it("picks the smallest round range that leaves room around the widest mark", () => {
    expect(stripRangeMs([0])).toBe(50);
    expect(stripRangeMs([0, -120])).toBe(150);
    expect(stripRangeMs([180, 20])).toBe(300);
    expect(stripRangeMs([5000])).toBe(800);
  });

  it("places marks from early on the left to late on the right, inside the strip", () => {
    expect(stripPosition(0, 200)).toBe(0.5);
    expect(stripPosition(-200, 200)).toBe(0);
    expect(stripPosition(100, 200)).toBe(0.75);
    expect(stripPosition(900, 200)).toBe(1);
  });

  it("finds the middle tap, ignoring a stray one", () => {
    expect(middleOf([30, 10, 900])).toBe(30);
    expect(middleOf([10, 20, 30, 40])).toBe(25);
    expect(middleOf([])).toBeNull();
  });

  it("says how early or late a sound is", () => {
    expect(earlyLateText(-120.4, "early", "late", "on the beat")).toBe("120 ms early");
    expect(earlyLateText(30, "sooner", "later", "together")).toBe("30 ms later");
    expect(earlyLateText(0.3, "early", "late", "on the beat")).toBe("on the beat");
  });
});
