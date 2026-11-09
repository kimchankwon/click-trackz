import { describe, expect, it } from "vitest";

import { hapticFor, isHapticBeat, isSide, panOf } from "./output";

describe("stereo side", () => {
  it("pans hard left, hard right or keeps the centre", () => {
    expect([panOf("left"), panOf("both"), panOf("right")]).toEqual([-1, 0, 1]);
  });

  it("only accepts the three sides", () => {
    expect(["left", "both", "right", "centre", ""].map(isSide)).toEqual([true, true, true, false, false]);
  });
});

describe("haptic beat", () => {
  it("taps hard on the downbeat, lightly on other beats only when asked, and never when off", () => {
    expect(hapticFor("off", { accent: true })).toBeNull();
    expect(hapticFor("downbeat", { accent: true })).toBe("strong");
    expect(hapticFor("downbeat", { accent: false })).toBeNull();
    expect(hapticFor("every", { accent: false })).toBe("light");
    expect(hapticFor("every", { accent: true })).toBe("strong");
  });

  it("only accepts the three settings", () => {
    expect(["off", "downbeat", "every", "on"].map(isHapticBeat)).toEqual([true, true, true, false]);
  });
});
