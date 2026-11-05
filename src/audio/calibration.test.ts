import { describe, expect, it } from "vitest";

import { calibrateLatency } from "./calibration";

describe("calibrateLatency", () => {
  it("turns a speaker round and an output round of taps into the extra delay of the output", () => {
    const nudge = calibrateLatency(
      { tapOffsetsMs: [40, 45, 38, 42, 300, 41], reportedLatencyMs: 10 },
      { tapOffsetsMs: [230, 241, 238, 236, 239, 900], reportedLatencyMs: 10 },
    );
    expect(nudge).toBe(197);
  });

  it("does not count delay the browser already reports and compensates for", () => {
    const nudge = calibrateLatency(
      { tapOffsetsMs: [40, 42, 41, 39, 43, 41], reportedLatencyMs: 10 },
      { tapOffsetsMs: [240, 242, 241, 239, 243, 241], reportedLatencyMs: 160 },
    );
    expect(nudge).toBe(50);
  });

  it("refuses to guess from too few or too scattered taps", () => {
    const steady = { tapOffsetsMs: [40, 42, 41, 39, 43, 41], reportedLatencyMs: 0 };
    expect(calibrateLatency(steady, { tapOffsetsMs: [200, 210, 205], reportedLatencyMs: 0 })).toBeNull();
    expect(calibrateLatency(steady, { tapOffsetsMs: [0, 300, 50, 400, 120, 520], reportedLatencyMs: 0 })).toBeNull();
  });
});
