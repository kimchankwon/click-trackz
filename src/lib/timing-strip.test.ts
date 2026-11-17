import { describe, expect, it } from "vitest";

import { earlyLateText, nudgeAtFraction, stripPosition } from "./timing-strip";

describe("timing strip", () => {
  it("places marks from early on the left to late on the right, inside the strip", () => {
    expect(stripPosition(0, 200)).toBe(0.5);
    expect(stripPosition(-200, 200)).toBe(0);
    expect(stripPosition(100, 200)).toBe(0.75);
    expect(stripPosition(900, 200)).toBe(1);
  });

  it("says how early or late a sound is", () => {
    expect(earlyLateText(-120.4, "early", "late", "on the beat")).toBe("120 ms early");
    expect(earlyLateText(30, "sooner", "later", "together")).toBe("30 ms later");
    expect(earlyLateText(0.3, "early", "late", "on the beat")).toBe("on the beat");
  });

  it("turns a dragged spot into the nudge that plays the device that early, within the nudge range", () => {
    expect(nudgeAtFraction(0.5, 500)).toBe(0);
    expect(nudgeAtFraction(0.3, 500)).toBe(200);
    expect(nudgeAtFraction(0.6, 500)).toBe(-100);
    expect(nudgeAtFraction(0, 500)).toBe(400);
    expect(nudgeAtFraction(1.4, 500)).toBe(-100);
    expect(stripPosition(-nudgeAtFraction(0.3, 500), 500)).toBeCloseTo(0.3);
  });
});
