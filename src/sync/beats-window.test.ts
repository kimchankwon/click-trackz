import { describe, expect, it } from "vitest";

import { beatsBetween, playbackEndsAt, type Playback, type Song } from "./timeline";

const songs: Record<string, Song> = {
  "two-bar Cue lead with a Count-in": {
    countIn: true,
    sections: [
      { sectionType: "Intro", bars: 4, beatsPerBar: 4, bpm: 120 },
      { sectionType: "Verse", number: 1, bars: 8, beatsPerBar: 4, bpm: 120, plays: 2 },
      { sectionType: "Chorus", bars: 1, beatsPerBar: 4, bpm: 120 },
      { sectionType: "Bridge", bars: 6, beatsPerBar: 3, bpm: 90, voiceCueEnabled: false },
      { sectionType: "Outro", bars: 4, beatsPerBar: 4, bpm: 120 },
    ],
  },
  "one-bar Cue lead with Time changes": {
    countIn: false,
    cueLeadBars: 1,
    sections: [
      { sectionType: "Verse", bars: 8, beatsPerBar: 4, bpm: 100, timeChanges: [{ bar: 4, bars: 1, beatsPerBar: 2, beatUnit: 4 }] },
      { sectionType: "Chorus", bars: 4, beatsPerBar: 6, beatUnit: 8, bpm: 70, plays: 3 },
      { sectionType: "Tag", bars: 2, beatsPerBar: 4, bpm: 100 },
    ],
  },
};

const playbacks = (song: Song): Record<string, Playback> => ({
  "from the top": { startsAt: 0, startSection: 0 },
  "from a later bar": { startsAt: 0, startSection: 1, startBar: 3 },
  "with Jumps": {
    startsAt: 0,
    startSection: 0,
    jumps: [
      { at: 9_000, toSection: song.sections.length - 1, cueFrom: 7_000 },
      { at: 15_000, toSection: 1, pass: 2 },
    ],
  },
  "stopped part way": { startsAt: 0, startSection: 0, stopsAt: 20_250 },
  vamping: { startsAt: 0, startSection: 0, jumps: [{ at: 6_000, toSection: 1, vamp: true }] },
});

describe("beatsBetween with a window", () => {
  for (const [songName, song] of Object.entries(songs)) {
    for (const [playbackName, playback] of Object.entries(playbacks(song))) {
      it(`matches the whole Playback cut to the window: ${songName}, ${playbackName}`, () => {
        const endsAt = playbackEndsAt(song, playback);
        const last = Number.isFinite(endsAt) ? endsAt + 1_000 : 60_000;
        for (let fromMs = -1_000; fromMs < last; fromMs += 730) {
          const toMs = fromMs + 2_600;
          const whole = beatsBetween(song, playback, -Infinity, toMs).filter((beat) => beat.at >= fromMs);
          expect(beatsBetween(song, playback, fromMs, toMs)).toEqual(whole);
        }
      });
    }
  }
});
