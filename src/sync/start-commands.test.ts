import { describe, expect, it } from "vitest";

import { jumpProblem, jumpsAfter, LEAD_IN_MS, startedPlayback, startProblem, stopTime } from "./commands";
import type { Song } from "./timeline";

const song: Song & { title: string } = {
  title: "Practice",
  countIn: false,
  sections: [
    { sectionType: "Intro", bars: 4, beatsPerBar: 4, bpm: 120 },
    { sectionType: "Verse", number: 1, bars: 2, beatsPerBar: 4, bpm: 120 },
  ],
};

describe("Playback commands", () => {
  it("starts after the lead-in, with a Count-in only when starting part way", () => {
    expect(startedPlayback(song, {}, 1_000)).toEqual({
      song: { countIn: false, sections: song.sections },
      startsAt: 1_000 + LEAD_IN_MS,
      startSection: 0,
      startBar: 1,
      jumps: [],
      stopsAt: null,
    });
    expect(startedPlayback(song, { fromSection: 1, fromBar: 2 }, 0)).toMatchObject({ song: { countIn: true }, startSection: 1, startBar: 2 });
  });

  it("carries the Song's Clicks per beat into Playback so every device subdivides alike", () => {
    expect(startedPlayback({ ...song, subdivision: 2 }, {}, 0).song).toEqual({ countIn: false, subdivision: 2, sections: song.sections });
    expect(startedPlayback({ ...song, subdivision: 1 }, {}, 0).song).not.toHaveProperty("subdivision");
    expect(startedPlayback({ ...song, subdivision: 7 }, {}, 0).song).not.toHaveProperty("subdivision");
  });

  it("refuses a Song with no Sections, or a start outside the Song", () => {
    expect(startProblem({ ...song, sections: [] }, {})).toMatch(/needs structure/);
    expect(startProblem(song, { fromSection: 2 })).toMatch(/not in the Song/);
    expect(startProblem(song, { fromSection: 1, fromBar: 3 })).toMatch(/only has 2 bars/);
    expect(startProblem(song, { fromSection: 1, fromBar: 2 })).toBeNull();
  });

  it("queues a Jump on the next bar line far enough ahead, replacing later Jumps", () => {
    const playback = { startsAt: 0, startSection: 0, jumps: [{ at: 8_000, toSection: 0 }] };
    expect(jumpProblem(song, 5)).toMatch(/not in the Song/);
    expect(jumpProblem(song, 1)).toBeNull();
    expect(jumpsAfter(song, playback, 1, "nextBar", 2_300)).toEqual([{ at: 4_000, toSection: 1, cueFrom: 3_300 }]);
    expect(jumpsAfter(song, playback, 1, "nextBar", 20_000)).toBeNull();
  });

  it("stops on the next bar line, or not at all once the Song is over", () => {
    expect(stopTime(song, { startsAt: 0, startSection: 0 }, 2_300)).toBe(4_000);
    expect(stopTime(song, { startsAt: 0, startSection: 0 }, 20_000)).toBeNull();
  });
});
