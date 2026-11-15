import { describe, expect, it } from "vitest";

import { earlyLateText, stripPosition } from "./timing-strip";

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
});
