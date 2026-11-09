import { describe, expect, it } from "vitest";

import { jumpsAfter, repeatJumps, startedPlayback } from "./commands";
import { nextSectionStart } from "./next-section";
import { beatsBetween, playbackEndsAt, playsOf, type Jump, type Playback, type Song } from "./timeline";

const song: Song = {
  countIn: false,
  cueLeadBars: 1,
  sections: [
    { sectionType: "Intro", bars: 1, beatsPerBar: 4, bpm: 120 },
    { sectionType: "Chorus", bars: 2, beatsPerBar: 4, bpm: 120, plays: 3 },
    { sectionType: "Outro", bars: 1, beatsPerBar: 4, bpm: 120 },
  ],
};
const fresh = { startsAt: 0, startSection: 0, jumps: [] as Jump[] };

const beatAt = (playback: Playback, at: number, on: Song = song) => beatsBetween(on, playback, at, at + 1)[0] ?? null;
const passAt = (playback: Playback, at: number, on: Song = song) => {
  const beat = beatAt(playback, at, on);
  return beat ? `${beat.sectionIndex}:${beat.barInSection}/${beat.barsInSection} pass ${beat.passInSection}/${beat.passesInSection}` : null;
};

const jumpsOf = (result: ReturnType<typeof repeatJumps>) => {
  if ("problem" in result) throw new Error(result.problem);
  return result.jumps;
};

describe("Plays", () => {
  it("counts one play unless a Section says more", () => {
    expect(playsOf(song.sections[0])).toBe(1);
    expect(playsOf(song.sections[1])).toBe(3);
    expect(playsOf({ ...song.sections[1], plays: 0 })).toBe(1);
  });

  it("plays a Section as many times in a row as its Plays, then moves on", () => {
    expect(passAt(fresh, 0)).toBe("0:1/1 pass 1/1");
    expect(passAt(fresh, 2_000)).toBe("1:1/2 pass 1/3");
    expect(passAt(fresh, 4_000)).toBe("1:2/2 pass 1/3");
    expect(passAt(fresh, 6_000)).toBe("1:1/2 pass 2/3");
    expect(passAt(fresh, 10_000)).toBe("1:1/2 pass 3/3");
    expect(passAt(fresh, 14_000)).toBe("2:1/1 pass 1/1");
    expect(playbackEndsAt(song, fresh)).toBe(16_000);
  });

  it("names the Section on the first beat of every pass", () => {
    expect([2_000, 6_000, 10_000].map((at) => beatAt(fresh, at)?.count)).toEqual(["CHORUS", "CHORUS", "CHORUS"]);
  });

  it("speaks the Voice cue before every pass", () => {
    expect([0, 4_000, 8_000, 12_000].map((at) => beatAt(fresh, at)?.voiceCue)).toEqual([
      { sectionType: "Chorus" },
      { sectionType: "Chorus" },
      { sectionType: "Chorus" },
      { sectionType: "Outro" },
    ]);
  });

  it("starts at a chosen bar of the first pass and still plays every pass", () => {
    const started = startedPlayback(song, { fromSection: 1, fromBar: 2 }, 0, 0);
    expect(passAt(started, 2_000, started.song)).toBe("1:2/2 pass 1/3");
    expect(passAt(started, 4_000, started.song)).toBe("1:1/2 pass 2/3");
    expect(playbackEndsAt(started.song, started)).toBe(2_000 + 2_000 + 8_000 + 2_000);
  });

  it("plays every pass after a Jump to the Section", () => {
    const jumped = { ...fresh, jumps: [{ at: 2_000, toSection: 1 }, { at: 4_000, toSection: 1 }] };
    expect(passAt(jumped, 4_000)).toBe("1:1/2 pass 1/3");
    expect(playbackEndsAt(song, jumped)).toBe(4_000 + 12_000 + 2_000);
  });

  it("Jumps at the end of the pass that is playing, not after every pass", () => {
    const jumps = jumpsAfter(song, fresh, 2, "endOfSection", 2_500);
    expect(jumps).toEqual([{ at: 6_000, toSection: 2, cueFrom: 3_500 }]);
  });

  it("tells the lead which pass of the Section is coming", () => {
    expect(beatAt(fresh, 0)?.lead).toMatchObject({ cue: { sectionType: "Chorus" }, pass: 1, passes: 3 });
    expect(beatAt(fresh, 8_000)?.lead).toMatchObject({ cue: { sectionType: "Chorus" }, pass: 3, passes: 3 });
    expect(beatAt(fresh, 12_000)?.lead).toMatchObject({ cue: { sectionType: "Outro" }, pass: 1, passes: 1 });
  });

  it("names the next pass as what comes next", () => {
    const ahead = beatsBetween(song, fresh, 2_500, 2_500 + 10_000);
    expect(nextSectionStart(ahead)).toEqual({ sectionIndex: 1, pass: 2, passes: 3 });
    const last = beatsBetween(song, fresh, 10_500, 10_500 + 10_000);
    expect(nextSectionStart(last)).toEqual({ sectionIndex: 2, pass: 1, passes: 1 });
  });
});

describe("Repeat on a Section with more than one play", () => {
  it("plays the pass that is ending once more, then the passes still to come", () => {
    const jumps = jumpsOf(repeatJumps(song, fresh, 6_500, false));
    expect(jumps).toEqual([{ at: 10_000, toSection: 1, pass: 2, cueFrom: 7_500 }]);
    const repeated = { ...fresh, jumps };
    expect(passAt(repeated, 10_000)).toBe("1:1/2 pass 2/3");
    expect(passAt(repeated, 14_000)).toBe("1:1/2 pass 3/3");
    expect(passAt(repeated, 18_000)).toBe("2:1/1 pass 1/1");
    expect(playbackEndsAt(song, repeated)).toBe(20_000);
  });

  it("adds one pass when pressed in the first pass", () => {
    const repeated = { ...fresh, jumps: jumpsOf(repeatJumps(song, fresh, 2_500, false)) };
    expect(repeated.jumps).toEqual([{ at: 6_000, toSection: 1, cueFrom: 3_500 }]);
    expect(playbackEndsAt(song, repeated)).toBe(20_000);
  });

  it("vamps one pass at a time and ends the vamp on the next Section", () => {
    const vamped = { ...fresh, jumps: jumpsOf(repeatJumps(song, fresh, 2_500, true)) };
    expect(vamped.jumps).toEqual([{ at: 6_000, toSection: 1, cueFrom: 3_500, vamp: true }]);
    expect(passAt(vamped, 6_000)).toBe("1:1/2 pass 1/1");
    expect(passAt(vamped, 30_000)).toBe("1:1/2 pass 1/1");
    expect(playbackEndsAt(song, vamped)).toBe(Infinity);
  });
});
