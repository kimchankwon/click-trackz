import { describe, expect, it } from "vitest";

import { estimateClockOffset } from "./clock";

describe("estimateClockOffset", () => {
  it("places the server reading at the midpoint of a single round trip", () => {
    const estimate = estimateClockOffset([{ sentAt: 1000, serverAt: 5060, receivedAt: 1100 }]);
    expect(estimate).toEqual({ offsetMs: 4010, uncertaintyMs: 50 });
  });

  it("trusts the sample with the shortest round trip", () => {
    const estimate = estimateClockOffset([
      { sentAt: 0, serverAt: 900, receivedAt: 400 },
      { sentAt: 1000, serverAt: 1520, receivedAt: 1040 },
      { sentAt: 2000, serverAt: 2700, receivedAt: 2300 },
    ]);
    expect(estimate).toEqual({ offsetMs: 500, uncertaintyMs: 20 });
  });

  it("has no estimate until a usable sample arrives", () => {
    expect(estimateClockOffset([])).toBeNull();
    expect(estimateClockOffset([{ sentAt: 500, serverAt: 900, receivedAt: 400 }])).toBeNull();
  });
});
