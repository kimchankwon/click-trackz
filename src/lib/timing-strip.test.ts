import { describe, expect, it } from "vitest";

import { earlyLateText, middleOf, stripPosition, stripRangeMs, tapSummary } from "./timing-strip";

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

  it("sums up each round of the tap test", () => {
    expect(tapSummary({ speaker: [], output: null })).toBe("No taps landed near the clicks");
    expect(tapSummary({ speaker: [180, 200, 220], output: null })).toBe("Your taps landed 200 ms after the clicks");
    expect(tapSummary({ speaker: [180, 200, 220], output: [300, 320, 340] })).toBe("Your output is 120 ms later than the speaker");
    expect(tapSummary({ speaker: [200], output: [200] })).toBe("Your output is no later than the speaker");
  });
});
