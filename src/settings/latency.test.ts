import { describe, expect, it } from "vitest";

import { LATENCY_MAX_MS, LATENCY_MIN_MS, nudgeFromShown, nudgeShown, nudgeText, SHOWN_NUDGE_MAX_MS, SHOWN_NUDGE_MIN_MS, signedMs, signedNumber } from "./latency";

describe("Latency nudge as shown", () => {
  it("shows a nudge that plays early as minus and one that plays late as plus", () => {
    expect(nudgeShown(180)).toBe(-180);
    expect(nudgeShown(-40)).toBe(40);
    expect(nudgeShown(0)).toBe(0);
    expect(Object.is(nudgeShown(0), 0)).toBe(true);
  });

  it("turns a shown value back into the stored nudge, kept in range", () => {
    expect(nudgeFromShown(-180)).toBe(180);
    expect(nudgeFromShown(40)).toBe(-40);
    expect(nudgeFromShown(-900)).toBe(LATENCY_MAX_MS);
    expect(nudgeFromShown(900)).toBe(LATENCY_MIN_MS);
    expect(nudgeFromShown(nudgeShown(37) + 1)).toBe(36);
  });

  it("covers the stored range with the shown range flipped", () => {
    expect(SHOWN_NUDGE_MIN_MS).toBe(-LATENCY_MAX_MS);
    expect(SHOWN_NUDGE_MAX_MS).toBe(-LATENCY_MIN_MS);
  });

  it("writes the sign out", () => {
    expect(signedMs(20)).toBe("+20 ms");
    expect(signedMs(-180)).toBe("−180 ms");
    expect(signedMs(0)).toBe("0 ms");
    expect(signedNumber(-10)).toBe("\u221210");
    expect(signedNumber(10)).toBe("+10");
    expect(signedNumber(0)).toBe("0");
    expect(nudgeText(180)).toBe("−180 ms");
    expect(nudgeText(-20)).toBe("+20 ms");
  });
});
