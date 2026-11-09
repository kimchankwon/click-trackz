import { describe, expect, it } from "vitest";

import { endVampJumps, jumpsAfter, repeatJumps } from "./commands";
import { aheadWindowMs, beatsBetween, playbackEndsAt, vampingSection, type Jump, type Song } from "./timeline";

const song: Song = {
  countIn: false,
  sections: [
    { sectionType: "Intro", bars: 4, beatsPerBar: 4, bpm: 120 },
    { sectionType: "Verse", bars: 2, beatsPerBar: 4, bpm: 120 },
  ],
};
const fresh = { startsAt: 0, startSection: 0, jumps: [] as Jump[] };

const jumpsOf = (result: ReturnType<typeof repeatJumps>) => {
  if ("problem" in result) throw new Error(result.problem);
  return result.jumps;
};

const countAt = (playback: typeof fresh, at: number) => beatsBetween(song, playback, at, at + 1)[0]?.count ?? null;

describe("Repeat", () => {
  it("plays the current Section once more from its end, then carries on", () => {
    const jumps = jumpsOf(repeatJumps(song, fresh, 1_000, false));
    expect(jumps).toEqual([{ at: 8_000, toSection: 0, cueFrom: 2_000 }]);
    const repeated = { ...fresh, jumps };
    expect(countAt(repeated, 8_000)).toBe("INTRO");
    expect(countAt(repeated, 16_000)).toBe("VERSE");
    expect(playbackEndsAt(song, repeated)).toBe(20_000);
  });

  it("waits for the first Section rather than repeating the Count-in", () => {
    const counted: Song = { ...song, countIn: true };
    expect(repeatJumps(counted, fresh, -1_500, false)).toEqual({ problem: "Wait for the first Section before repeating it" });
  });

  it("repeats the Section that is playing when the boundary comes, even if pressed in the last second of the one before", () => {
    const jumps = jumpsOf(repeatJumps(song, fresh, 7_500, false));
    expect(jumps).toEqual([{ at: 12_000, toSection: 1, cueFrom: 8_500 }]);
  });
});

describe("Vamp", () => {
  const vamping = { ...fresh, jumps: jumpsOf(repeatJumps(song, fresh, 1_000, true)) };

  it("loops the current Section from its end until someone ends the vamp", () => {
    expect(vamping.jumps).toEqual([{ at: 8_000, toSection: 0, cueFrom: 2_000, loop: true }]);
    expect(vampingSection(song, vamping)).toBe(0);
    expect(playbackEndsAt(song, vamping)).toBe(Infinity);
    expect(countAt(vamping, 30_000)).toBe("4");
    expect(countAt(vamping, 32_000)).toBe("INTRO");
    expect(countAt(vamping, 600_000)).toBe("INTRO");
  });

  it("cues the Section again before each repeat", () => {
    const lead = beatsBetween(song, vamping, 28_000, 32_000);
    expect(lead.every((beat) => beat.lead?.cue?.sectionType === "Intro")).toBe(true);
    expect(lead[0].voiceCue).toEqual({ sectionType: "Intro" });
  });

  it("will not stack a Repeat on a vamp", () => {
    expect(repeatJumps(song, vamping, 20_000, false)).toEqual({ problem: "Already vamping: end the vamp first" });
  });

  it("ends at the end of the current pass and goes on to the next Section", () => {
    const ended = { ...vamping, jumps: jumpsOf(endVampJumps(song, vamping, 25_000)) };
    expect(ended.jumps.at(-1)).toEqual({ at: 32_000, toSection: 1, cueFrom: 26_000 });
    expect(vampingSection(song, ended)).toBeNull();
    expect(countAt(ended, 32_000)).toBe("VERSE");
    expect(playbackEndsAt(song, ended)).toBe(36_000);
  });

  it("ends the Song when the vamp is on the last Section", () => {
    const onVerse = { startsAt: 0, startSection: 1, jumps: [] as Jump[] };
    const looping = { ...onVerse, jumps: jumpsOf(repeatJumps(song, onVerse, 500, true)) };
    expect(looping.jumps).toEqual([{ at: 4_000, toSection: 1, cueFrom: 1_500, loop: true }]);
    const ended = { ...looping, jumps: jumpsOf(endVampJumps(song, looping, 9_000)) };
    expect(playbackEndsAt(song, ended)).toBe(12_000);
    expect(beatsBetween(song, ended, 12_000, 20_000)).toEqual([]);
  });

  it("cancels a vamp that has not started yet", () => {
    const ended = { ...vamping, jumps: jumpsOf(endVampJumps(song, vamping, 3_000)) };
    expect(ended.jumps).toEqual([{ at: 8_000, toSection: 1, cueFrom: 4_000 }]);
    expect(playbackEndsAt(song, ended)).toBe(12_000);
  });

  it("is also left by tapping another Section", () => {
    const jumps = jumpsAfter(song, vamping, 1, "nextBar", 25_000);
    expect(jumps?.at(-1)).toEqual({ at: 28_000, toSection: 1, cueFrom: 26_000 });
    expect(vampingSection(song, { ...vamping, jumps: jumps! })).toBeNull();
  });

  it("says nothing is vamping when there is no vamp", () => {
    expect(endVampJumps(song, fresh, 1_000)).toEqual({ problem: "Nothing is vamping" });
  });

  it("looks far enough ahead to find the next Section start from anywhere in the Song", () => {
    expect(aheadWindowMs(song)).toBe(8_000 + 3 * 2_000);
  });
});
