import { describe, expect, it } from "vitest";

import { pingDelayMs } from "./ping-schedule";

const settled = { sinceOpenMs: 10 * 60_000, hidden: false, hasEstimate: true };

describe("pingDelayMs", () => {
  it("pings every 5 seconds for the first 15 seconds after opening", () => {
    expect(pingDelayMs({ ...settled, sinceOpenMs: 10_000 })).toBe(5_000);
  });

  it("pings every 10 seconds after that, during Playback too, so the clock never drifts far between pings", () => {
    expect(pingDelayMs(settled)).toBe(10_000);
  });

  it("keeps the faster pace until the first estimate", () => {
    expect(pingDelayMs({ ...settled, hasEstimate: false })).toBe(5_000);
  });

  it("stops pinging while the app is hidden", () => {
    expect(pingDelayMs({ ...settled, hidden: true })).toBeNull();
    expect(pingDelayMs({ ...settled, sinceOpenMs: 10_000, hidden: true })).toBeNull();
  });
});
