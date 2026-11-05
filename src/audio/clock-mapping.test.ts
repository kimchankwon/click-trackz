import { describe, expect, it } from "vitest";

import { audioTimeFor, slewMapping } from "./clock-mapping";

describe("audioTimeFor", () => {
  it("converts a beat's server time to AudioContext seconds, early by the output latency", () => {
    expect(audioTimeFor(10_000, { audioMinusServerMs: -9_000 }, 20)).toBeCloseTo(0.98, 6);
  });
});

describe("slewMapping", () => {
  it("adopts the first measurement outright", () => {
    expect(slewMapping(null, -9_000)).toEqual({ audioMinusServerMs: -9_000 });
  });

  it("moves towards a small change by at most one millisecond per step", () => {
    expect(slewMapping({ audioMinusServerMs: -9_000 }, -9_004)).toEqual({ audioMinusServerMs: -9_001 });
    expect(slewMapping({ audioMinusServerMs: -9_000 }, -8_999.5)).toEqual({ audioMinusServerMs: -8_999.5 });
  });

  it("snaps to a change larger than 50 ms instead of drifting there", () => {
    expect(slewMapping({ audioMinusServerMs: -9_000 }, -9_080)).toEqual({ audioMinusServerMs: -9_080 });
  });
});
