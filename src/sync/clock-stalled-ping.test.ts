import { describe, expect, it } from "vitest";

import { estimateClockOffset, type ClockSample } from "./clock";

describe("estimateClockOffset with a stalled ping", () => {
  const OFFSET_MS = 5_000;
  const ROUND_TRIP_MS = 40;
  const STALL_MS = 3 * 60_000;

  const quick = (sentAt: number): ClockSample => ({ sentAt, serverAt: sentAt + ROUND_TRIP_MS / 2 + OFFSET_MS, receivedAt: sentAt + ROUND_TRIP_MS });

  it("does not let one ping that waited three minutes for the connection replace the estimate", () => {
    const beforeTheOutage = [0, 10_000, 20_000, 30_000].map(quick);
    const sentAt = 40_000;
    const stalled: ClockSample = { sentAt, serverAt: sentAt + STALL_MS - ROUND_TRIP_MS / 2 + OFFSET_MS, receivedAt: sentAt + STALL_MS };

    const estimate = estimateClockOffset([...beforeTheOutage, stalled]);

    expect(estimate).not.toBeNull();
    expect(Math.abs((estimate?.offsetMs ?? Infinity) - OFFSET_MS)).toBeLessThan(1);
  });
});
