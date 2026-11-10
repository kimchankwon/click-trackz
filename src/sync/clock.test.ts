import { describe, expect, it } from "vitest";

import { clockSlept, estimateClockOffset } from "./clock";

describe("estimateClockOffset", () => {
  it("places the server reading at the midpoint of a single round trip", () => {
    const estimate = estimateClockOffset([{ sentAt: 1000, serverAt: 5060, receivedAt: 1100 }]);
    expect(estimate).toEqual({ offsetMs: 4010, uncertaintyMs: 50, roundTripMs: 100 });
  });

  it("trusts the sample with the shortest round trip", () => {
    const estimate = estimateClockOffset([
      { sentAt: 0, serverAt: 900, receivedAt: 400 },
      { sentAt: 1000, serverAt: 1520, receivedAt: 1040 },
      { sentAt: 2000, serverAt: 2700, receivedAt: 2300 },
    ]);
    expect(estimate).toEqual({ offsetMs: 500, uncertaintyMs: 20, roundTripMs: 40 });
  });

  it("averages the samples whose round trips are within 5 ms of the shortest", () => {
    const estimate = estimateClockOffset([
      { sentAt: 0, serverAt: 520, receivedAt: 40 },
      { sentAt: 10_000, serverAt: 10_528, receivedAt: 10_044 },
      { sentAt: 20_000, serverAt: 20_560, receivedAt: 20_060 },
    ]);
    expect(estimate).toEqual({ offsetMs: 503, uncertaintyMs: 20, roundTripMs: 40 });
  });

  it("drops samples more than 2 minutes older than the newest, so a drifting device clock cannot keep a stale offset", () => {
    const old = { sentAt: 0, serverAt: 520, receivedAt: 40 };
    const freshAt = (at: number) => ({ sentAt: at, serverAt: at + 750, receivedAt: at + 100 });
    expect(estimateClockOffset([old, freshAt(5 * 60_000)])).toEqual({ offsetMs: 700, uncertaintyMs: 50, roundTripMs: 100 });
    expect(estimateClockOffset([old, freshAt(60_000)])).toEqual({ offsetMs: 500, uncertaintyMs: 20, roundTripMs: 40 });
  });

  it("knows the device slept when the wall clock moved on but the monotonic clock did not", () => {
    expect(clockSlept(1_000, 1_050)).toBe(false);
    expect(clockSlept(1_000, 4_000)).toBe(true);
    expect(clockSlept(4_000, 1_000)).toBe(true);
  });

  it("has no estimate until a usable sample arrives", () => {
    expect(estimateClockOffset([])).toBeNull();
    expect(estimateClockOffset([{ sentAt: 500, serverAt: 900, receivedAt: 400 }])).toBeNull();
  });
});
