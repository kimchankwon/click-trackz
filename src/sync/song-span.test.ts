import { describe, expect, it } from "vitest";

import { clockText, elapsedShare, playbackSpan, songLengthMs } from "./song-span";
import type { Song } from "./timeline";

const song: Song = {
  countIn: false,
  sections: [
    { sectionType: "Verse", bars: 2, beatsPerBar: 4, bpm: 120 },
    { sectionType: "Chorus", bars: 4, beatsPerBar: 4, bpm: 120 },
  ],
};

describe("songLengthMs", () => {
  it("adds up every bar from the start Section", () => {
    expect(songLengthMs(song)).toBe(12_000);
    expect(songLengthMs(song, 1)).toBe(8_000);
    expect(songLengthMs(song, 1, 3)).toBe(4_000);
  });

  it("counts the Count-in bar", () => {
    expect(songLengthMs({ ...song, countIn: true })).toBe(14_000);
  });

  it("is zero for a Song without Sections", () => {
    expect(songLengthMs({ countIn: true, sections: [] })).toBe(0);
  });
});

describe("elapsedShare", () => {
  const span = playbackSpan(song, { startsAt: 1_000, startSection: 0 });

  it("runs from the first beat to the end of the Song", () => {
    expect(span).toEqual({ startsAt: 1_000, endsAt: 13_000 });
    expect(elapsedShare(span, 7_000)).toBe(0.5);
  });

  it("stays between empty and full", () => {
    expect(elapsedShare(span, 0)).toBe(0);
    expect(elapsedShare(span, 20_000)).toBe(1);
    expect(elapsedShare(span, null)).toBe(0);
  });

  it("ends early when Playback is stopped", () => {
    const stopped = playbackSpan(song, { startsAt: 1_000, startSection: 0, stopsAt: 5_000 });
    expect(stopped.endsAt).toBe(5_000);
  });
});

describe("clockText", () => {
  it("shows minutes and seconds", () => {
    expect(clockText(0)).toBe("0:00");
    expect(clockText(65_400)).toBe("1:05");
    expect(clockText(-300)).toBe("0:00");
  });
});
