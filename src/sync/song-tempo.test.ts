import { describe, expect, it } from "vitest";

import { commonBpm, markOwnTempos, withSongTempo } from "./song-tempo";

describe("Song tempo", () => {
  it("takes the BPM most Sections share, the earliest on a tie, or none without Sections", () => {
    expect(commonBpm([{ bpm: 70 }, { bpm: 140 }, { bpm: 140 }])).toBe(140);
    expect(commonBpm([{ bpm: 70 }, { bpm: 140 }])).toBe(70);
    expect(commonBpm([])).toBeNull();
  });

  it("gives every Section without its own tempo the Song tempo", () => {
    expect(withSongTempo([{ bpm: 70 }, { bpm: 90, ownTempo: true }, { bpm: 70, ownTempo: false }], 140)).toEqual([
      { bpm: 140 },
      { bpm: 90, ownTempo: true },
      { bpm: 140, ownTempo: false },
    ]);
  });

  it("marks older Sections whose BPM differs from the Song tempo as having their own", () => {
    expect(markOwnTempos([{ bpm: 140 }, { bpm: 70 }, { bpm: 70, ownTempo: false }], 140)).toEqual([
      { bpm: 140, ownTempo: false },
      { bpm: 70, ownTempo: true },
      { bpm: 70, ownTempo: false },
    ]);
  });
});
