import { describe, expect, it } from "vitest";

import { spokenCountFits, voiceEndsAt } from "./voice-overlap";

describe("spokenCountFits", () => {
  const BEAT_MS = 500;
  const LEAD_MS = 20;

  it("skips a count that would start more than 100 ms before a long Voice cue ends", () => {
    const busyUntil = voiceEndsAt(0, LEAD_MS, 620);
    expect(spokenCountFits(BEAT_MS, LEAD_MS, busyUntil)).toBe(false);
  });

  it("plays a count once the Voice cue has nearly finished", () => {
    const busyUntil = voiceEndsAt(0, LEAD_MS, 500);
    expect(spokenCountFits(BEAT_MS, LEAD_MS, busyUntil)).toBe(true);
  });

  it("plays every count when no Voice cue is sounding", () => {
    expect(spokenCountFits(BEAT_MS, LEAD_MS, -Infinity)).toBe(true);
  });
});
