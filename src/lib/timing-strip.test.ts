import { describe, expect, it } from "vitest";

import { nudgeFromShown, nudgeShown } from "@/settings/latency";

import { earlyLateText, nudgeAfterDrag, stripKeySteps, stripPosition } from "./timing-strip";

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

  it("moves a nudge by how far the circle is dragged, not to where the finger lands", () => {
    expect(nudgeAfterDrag(250, 0, 300, 500)).toBe(250);
    expect(nudgeAfterDrag(250, 30, 300, 500)).toBe(150);
    expect(nudgeAfterDrag(250, -30, 300, 500)).toBe(350);
    expect(nudgeAfterDrag(250, 300, 300, 500)).toBe(-100);
    expect(nudgeAfterDrag(0, -300, 300, 500)).toBe(400);
    expect(nudgeAfterDrag(250, 40, 0, 500)).toBe(250);
    expect(stripPosition(-nudgeAfterDrag(250, 30, 300, 500), 500) - stripPosition(-250, 500)).toBeCloseTo(0.1);
  });

  it("steps a lane later with Right, Up and Page Up, and earlier with Left, Down and Page Down", () => {
    expect(stripKeySteps).toEqual({ ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, PageUp: 10, PageDown: -10 });
    const later = nudgeFromShown(nudgeShown(100) + stripKeySteps.ArrowRight);
    expect(later).toBe(99);
    expect(stripPosition(-later, 500)).toBeGreaterThan(stripPosition(-100, 500));
    expect(nudgeFromShown(nudgeShown(100) + stripKeySteps.PageDown)).toBe(110);
  });
});
