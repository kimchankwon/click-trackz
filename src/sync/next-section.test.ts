import { describe, expect, it } from "vitest";

import { nextSectionStart } from "./next-section";
import { beatsBetween, type Song } from "./timeline";

const section = (sectionType: string) => ({ sectionType, bars: 2, beatsPerBar: 4, bpm: 120, voiceCueEnabled: false });
const song: Song = { countIn: false, sections: [section("Intro"), section("Verse"), section("Chorus"), section("Bridge")] };

describe("nextSectionStart", () => {
  it("names the Section that follows in order", () => {
    const ahead = beatsBetween(song, { startsAt: 0, startSection: 0 }, 1_000, 60_000);
    expect(nextSectionStart(ahead)?.sectionIndex ?? null).toBe(1);
  });

  it("names the Section a queued Jump goes to, even with its Voice cue off", () => {
    const playback = { startsAt: 0, startSection: 0, jumps: [{ at: 4_000, toSection: 3 }] };
    const ahead = beatsBetween(song, playback, 1_000, 60_000);
    expect(nextSectionStart(ahead)?.sectionIndex ?? null).toBe(3);
  });

  it("names a Jump back to the Section that is playing", () => {
    const playback = { startsAt: 0, startSection: 0, jumps: [{ at: 4_000, toSection: 0 }] };
    const ahead = beatsBetween(song, playback, 1_000, 60_000);
    expect(nextSectionStart(ahead)?.sectionIndex ?? null).toBe(0);
  });

  it("has nothing next during the last Section", () => {
    const ahead = beatsBetween(song, { startsAt: 0, startSection: 3 }, 1_000, 60_000);
    expect(nextSectionStart(ahead)?.sectionIndex ?? null).toBeNull();
  });
});
