import { describe, expect, it } from "vitest";

import { nudgeFromTapTest, tapOffsets } from "./tap-test";

describe("nudgeFromTapTest", () => {
  it("turns a speaker round and an output round of taps into the extra delay of the output", () => {
    const nudge = nudgeFromTapTest(
      { tapOffsetsMs: [40, 45, 38, 42, 300, 41], reportedLatencyMs: 10 },
      { tapOffsetsMs: [230, 241, 238, 236, 239, 900], reportedLatencyMs: 10 },
    );
    expect(nudge).toBe(197);
  });

  it("does not count delay the browser already reports and compensates for", () => {
    const nudge = nudgeFromTapTest(
      { tapOffsetsMs: [40, 42, 41, 39, 43, 41], reportedLatencyMs: 10 },
      { tapOffsetsMs: [240, 242, 241, 239, 243, 241], reportedLatencyMs: 160 },
    );
    expect(nudge).toBe(50);
  });

  it("refuses to guess from too few or too scattered taps", () => {
    const steady = { tapOffsetsMs: [40, 42, 41, 39, 43, 41], reportedLatencyMs: 0 };
    expect(nudgeFromTapTest(steady, { tapOffsetsMs: [200, 210, 205], reportedLatencyMs: 0 })).toBeNull();
    expect(nudgeFromTapTest(steady, { tapOffsetsMs: [0, 300, 50, 400, 120, 520], reportedLatencyMs: 0 })).toBeNull();
  });
});

describe("tapOffsets", () => {
  it("pairs each tap with the click it follows, so long delays do not wrap onto the next click", () => {
    const clicks = [0, 1_000, 2_000, 3_000, 4_000];
    expect(tapOffsets(clicks, [2_380, 3_420, 4_390], 2)).toEqual([380, 420, 390]);
  });

  it("counts a slightly early tap against the click it anticipates and ignores warm-up clicks and stray taps", () => {
    const clicks = [0, 1_000, 2_000, 3_000];
    expect(tapOffsets(clicks, [500, 1_960, 2_900, 3_950], 2)).toEqual([-40, -100, 950]);
  });
});
