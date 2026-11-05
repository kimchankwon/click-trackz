import { describe, expect, it } from "vitest";

import { pingDelayMs } from "./ping-schedule";

describe("pingDelayMs", () => {
  it("pings every 5 seconds for the first half minute after opening", () => {
    expect(pingDelayMs({ sinceOpenMs: 10_000, fast: false, hidden: false })).toBe(5_000);
  });

  it("pings every 5 seconds while Playback is running", () => {
    expect(pingDelayMs({ sinceOpenMs: 10 * 60_000, fast: true, hidden: false })).toBe(5_000);
  });

  it("slows to once a minute when nothing is playing", () => {
    expect(pingDelayMs({ sinceOpenMs: 10 * 60_000, fast: false, hidden: false })).toBe(60_000);
  });

  it("stops pinging while the app is hidden", () => {
    expect(pingDelayMs({ sinceOpenMs: 10_000, fast: true, hidden: true })).toBeNull();
  });
});
