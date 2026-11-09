import { describe, expect, it } from "vitest";

import { jumpsAfter, repeatJumps, startedPlayback } from "./commands";
import { mainTimeSignature } from "./song-summary";
import { newTimeChange, timeChangesProblem } from "./time-changes";
import { beatsBetween, playbackEndsAt, type Jump, type Playback, type Song } from "./timeline";

const chorus = { sectionType: "Chorus", bars: 8, beatsPerBar: 4, beatUnit: 4, bpm: 120, timeChanges: [{ bar: 8, bars: 1, beatsPerBar: 2, beatUnit: 4 }] };
const verse = { sectionType: "Verse", bars: 4, beatsPerBar: 4, bpm: 120 };
const song: Song = { countIn: false, cueLeadBars: 2, sections: [chorus, verse] };
const fresh = { startsAt: 0, startSection: 0, jumps: [] as Jump[] };

const beatsOf = (playback: Playback, from: number, to: number, on: Song = song) => beatsBetween(on, playback, from, to);
const barAt = (playback: Playback, at: number, on: Song = song) => {
  const bar = beatsOf(playback, at, at + 1, on)[0];
  return bar ? `${bar.sectionIndex}:${bar.barInSection}/${bar.barsInSection} in ${bar.beatsPerBar}/${bar.beatUnit}` : null;
};
const spoken = (playback: Playback, from: number, to: number) =>
  beatsOf(playback, from, to)
    .map((beat) => (beat.voiceCue ? beat.voiceCue.sectionType.toUpperCase() : beat.spokenCount === null ? "-" : String(beat.spokenCount)))
    .join(" ");

describe("Time changes", () => {
  it("plays the changed bars in their own time signature inside the same Section", () => {
    expect(barAt(fresh, 12_000)).toBe("0:7/8 in 4/4");
    expect(barAt(fresh, 14_000)).toBe("0:8/8 in 2/4");
    expect(barAt(fresh, 15_000)).toBe("1:1/4 in 4/4");
    expect(beatsOf(fresh, 14_000, 15_000).map((beat) => [beat.count, beat.beatMs])).toEqual([
      ["8", 500],
      ["2", 500],
    ]);
    expect(playbackEndsAt(song, fresh)).toBe(15_000 + 8_000);
  });

  it("starts the next Section's Voice cue two bars early, across the changed bar", () => {
    expect(spoken(fresh, 10_000, 15_000)).toBe("- - - - VERSE - 2 - 3 -");
  });

  it("gives the changed bars no Voice cue of their own", () => {
    expect(beatsOf(fresh, 0, 15_000).filter((beat) => beat.voiceCue !== null).map((beat) => beat.voiceCue?.sectionType)).toEqual(["Verse"]);
  });

  it("keeps the note value steady when the change counts a different note", () => {
    const eighths: Song = { ...song, sections: [{ ...chorus, bars: 2, timeChanges: [{ bar: 2, bars: 1, beatsPerBar: 3, beatUnit: 8 }] }, verse] };
    expect(beatsOf(fresh, 2_000, 2_750, eighths).map((beat) => [beat.at, beat.beatMs, beat.beatUnit])).toEqual([
      [2_000, 250, 8],
      [2_250, 250, 8],
      [2_500, 250, 8],
    ]);
    expect(barAt(fresh, 2_750, eighths)).toBe("1:1/4 in 4/4");
  });

  it("fills the progress bar by time, so the short bar takes a short share", () => {
    const [first, second] = beatsOf(fresh, 14_000, 15_000);
    expect([first.msIntoPass, second.msIntoPass, first.passMs]).toEqual([14_000, 14_500, 15_000]);
  });

  it("plays the change again in every pass of a Section that plays more than once", () => {
    const twice: Song = { ...song, sections: [{ ...chorus, plays: 2 }, verse] };
    expect(barAt(fresh, 29_000, twice)).toBe("0:8/8 in 2/4");
    expect(barAt(fresh, 30_000, twice)).toBe("1:1/4 in 4/4");
  });

  it("starts at a changed bar after a Count-in in the Section's own time signature", () => {
    const started = startedPlayback(song, { fromSection: 0, fromBar: 8 }, 0, 0);
    expect(barAt(started, 0, started.song)).toBe("null:1/2 in 4/4");
    expect(barAt(started, 4_000, started.song)).toBe("0:8/8 in 2/4");
    expect(barAt(started, 5_000, started.song)).toBe("1:1/4 in 4/4");
  });

  it("lands a next-bar Jump on the changed bar's bar line", () => {
    expect(jumpsAfter(song, fresh, 1, "nextBar", 12_500)).toEqual([{ at: 14_000, toSection: 1, cueFrom: 13_500 }]);
    expect(jumpsAfter(song, fresh, 1, "nextBar", 13_500)).toEqual([{ at: 15_000, toSection: 1, cueFrom: 14_500 }]);
  });

  it("vamps a whole pass, changed bar included", () => {
    const vamped = { ...fresh, jumps: (repeatJumps(song, fresh, 1_000, true) as { jumps: Jump[] }).jumps };
    expect(vamped.jumps).toEqual([{ at: 15_000, toSection: 0, cueFrom: 2_000, vamp: true }]);
    expect(barAt(vamped, 15_000 + 14_000)).toBe("0:8/8 in 2/4");
    expect(barAt(vamped, 15_000 + 15_000)).toBe("0:1/8 in 4/4");
  });
});

describe("timeChangesProblem", () => {
  const base = { bars: 8, beatsPerBar: 4, beatUnit: 4 };
  const change = (bar: number, bars = 1, beatsPerBar = 2, beatUnit = 4) => ({ bar, bars, beatsPerBar, beatUnit });

  it("accepts changes that fit inside the Section without overlapping, in any order", () => {
    expect(timeChangesProblem({ ...base, timeChanges: [change(8), change(1, 2, 3)] })).toBeNull();
    expect(timeChangesProblem(base)).toBeNull();
  });

  it("names the change that does not fit", () => {
    expect(timeChangesProblem({ ...base, timeChanges: [change(9)] })).toBe("A time change must start on a bar from 1 to 8");
    expect(timeChangesProblem({ ...base, timeChanges: [change(7, 3)] })).toBe("The time change at bar 7 runs past the end of the Section");
    expect(timeChangesProblem({ ...base, timeChanges: [change(2, 3), change(4)] })).toBe("The time change at bar 4 overlaps the one before it");
    expect(timeChangesProblem({ ...base, timeChanges: [change(8, 1, 13)] })).toBe("The time change at bar 8 needs 1 to 12 beats per bar");
    expect(timeChangesProblem({ ...base, timeChanges: [change(8, 1, 3, 3)] })).toBe(
      "The time change at bar 8 must count halves, quarters, eighths or sixteenths",
    );
  });
});

describe("newTimeChange", () => {
  it("offers one bar of 2/4 on the last bar that has no change yet", () => {
    expect(newTimeChange({ bars: 8, beatsPerBar: 4, beatUnit: 4 })).toEqual({ bar: 8, bars: 1, beatsPerBar: 2, beatUnit: 4 });
    expect(newTimeChange({ bars: 8, beatsPerBar: 4, timeChanges: [{ bar: 7, bars: 2, beatsPerBar: 2, beatUnit: 4 }] })).toMatchObject({ bar: 6 });
    expect(newTimeChange({ bars: 4, beatsPerBar: 2, beatUnit: 4 })).toMatchObject({ beatsPerBar: 3 });
  });

  it("offers nothing for a one-bar Section or one with every bar changed", () => {
    expect(newTimeChange({ bars: 1, beatsPerBar: 4 })).toBeNull();
    expect(newTimeChange({ bars: 2, beatsPerBar: 4, timeChanges: [{ bar: 1, bars: 2, beatsPerBar: 2, beatUnit: 4 }] })).toBeNull();
  });
});

describe("Song summary with time changes", () => {
  it("counts the changed bars toward their own time signature", () => {
    expect(mainTimeSignature([{ bars: 8, beatsPerBar: 4, bpm: 120, timeChanges: [{ bar: 1, bars: 6, beatsPerBar: 6, beatUnit: 8 }] }])).toBe("6/8");
    expect(mainTimeSignature([chorus, verse])).toBe("4/4");
  });
});
