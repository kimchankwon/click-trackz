import { describe, expect, it } from "vitest";

import { pingDelayMs } from "./ping-schedule";

const settled = { sinceOpenMs: 10 * 60_000, hidden: false, hasEstimate: true, pace: "playback" } as const;

describe("pingDelayMs", () => {
  it("pings every 5 seconds for the first 15 seconds after opening", () => {
    expect(pingDelayMs({ ...settled, sinceOpenMs: 10_000 })).toBe(5_000);
    expect(pingDelayMs({ ...settled, sinceOpenMs: 10_000, pace: "standby" })).toBe(5_000);
  });

  it("pings every 10 seconds during Playback, so the clock never drifts far between pings", () => {
    expect(pingDelayMs(settled)).toBe(10_000);
  });

  it("pings every 30 seconds while nothing plays, still inside the two minutes of samples an estimate uses", () => {
    expect(pingDelayMs({ ...settled, pace: "standby" })).toBe(30_000);
  });

  it("keeps the faster pace until the first estimate", () => {
    expect(pingDelayMs({ ...settled, hasEstimate: false })).toBe(5_000);
    expect(pingDelayMs({ ...settled, hasEstimate: false, pace: "standby" })).toBe(5_000);
  });

  it("stops pinging while the app is hidden", () => {
    expect(pingDelayMs({ ...settled, hidden: true })).toBeNull();
    expect(pingDelayMs({ ...settled, sinceOpenMs: 10_000, hidden: true })).toBeNull();
  });

  it("stops pinging while paused, even before the first estimate", () => {
    expect(pingDelayMs({ ...settled, pace: "paused" })).toBeNull();
    expect(pingDelayMs({ ...settled, sinceOpenMs: 10_000, hasEstimate: false, pace: "paused" })).toBeNull();
  });
});
