import { describe, expect, it } from "vitest";

import { pingDelayMs } from "./ping-schedule";

const idle = { sinceOpenMs: 10 * 60_000, playing: false, hidden: false, hasEstimate: true };

describe("pingDelayMs", () => {
  it("pings every 5 seconds for the first half minute after opening", () => {
    expect(pingDelayMs({ ...idle, sinceOpenMs: 10_000 })).toBe(5_000);
  });

  it("slows to once a minute when nothing is playing", () => {
    expect(pingDelayMs(idle)).toBe(60_000);
  });

  it("holds the clock steady while Playback is running", () => {
    expect(pingDelayMs({ ...idle, playing: true })).toBeNull();
    expect(pingDelayMs({ ...idle, playing: true, sinceOpenMs: 10_000 })).toBeNull();
  });

  it("keeps measuring during Playback until a late joiner has its first estimate", () => {
    expect(pingDelayMs({ ...idle, playing: true, hasEstimate: false, sinceOpenMs: 3_000 })).toBe(5_000);
  });

  it("stops pinging while the app is hidden", () => {
    expect(pingDelayMs({ ...idle, sinceOpenMs: 10_000, hidden: true })).toBeNull();
  });
});
