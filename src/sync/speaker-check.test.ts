import { describe, expect, it } from "vitest";

import { playsInSpeakerCheck, speakerCheckBars, speakerCheckLive, speakerCheckPlan, SPEAKER_CHECK_MS } from "./speaker-check";
import { beatsBetween, MAX_BARS, playbackEndsAt } from "./timeline";

const check = { startsAt: 10_000, stopsAt: 10_000 + SPEAKER_CHECK_MS, listenTo: null, comparedWith: "admin-phone" };

describe("Speaker check", () => {
  it("clicks once a second from its start, with no Voice cue or spoken count", () => {
    const { song, playback } = speakerCheckPlan(check);
    const beats = beatsBetween(song, playback, 0, check.startsAt + 4_500);
    expect(beats.map((beat) => beat.at)).toEqual([10_000, 11_000, 12_000, 13_000, 14_000]);
    expect(beats.every((beat) => beat.voiceCue === null && beat.spokenCount === null)).toBe(true);
    expect(beats.map((beat) => beat.accent)).toEqual([true, false, false, false, true]);
  });

  it("plays nothing at or after its stop", () => {
    const stopped = { ...check, stopsAt: check.startsAt + 2_500 };
    const { song, playback } = speakerCheckPlan(stopped);
    expect(beatsBetween(song, playback, 0, check.startsAt + 10_000).map((beat) => beat.at)).toEqual([10_000, 11_000, 12_000]);
    expect(playbackEndsAt(song, playback)).toBe(stopped.stopsAt);
  });

  it("covers the whole check with bars, within the Section limit", () => {
    expect(speakerCheckBars(check)).toBe(75);
    expect(speakerCheckBars({ startsAt: 0, stopsAt: 1 })).toBe(1);
    expect(speakerCheckBars({ startsAt: 0, stopsAt: 60 * 60_000 })).toBe(MAX_BARS);
  });

  it("is live until it stops", () => {
    expect(speakerCheckLive(check, check.startsAt - 500)).toBe(true);
    expect(speakerCheckLive(check, check.stopsAt)).toBe(false);
    expect(speakerCheckLive(check, null)).toBe(false);
    expect(speakerCheckLive(null, 0)).toBe(false);
  });

  it("plays on every device until the Admin listens to one, then only on that one and theirs", () => {
    expect(playsInSpeakerCheck(check, "drums")).toBe(true);
    const listening = { ...check, listenTo: "keys" };
    expect(playsInSpeakerCheck(listening, "keys")).toBe(true);
    expect(playsInSpeakerCheck(listening, "admin-phone")).toBe(true);
    expect(playsInSpeakerCheck(listening, "drums")).toBe(false);
  });
});
