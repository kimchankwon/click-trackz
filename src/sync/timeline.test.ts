import { describe, expect, it } from "vitest";

import { beatsBetween, playbackEndsAt, type Song } from "./timeline";

const intro = { sectionType: "Intro", bars: 1, beatsPerBar: 4, bpm: 120 };

describe("beatsBetween", () => {
  it("counts a one-bar Section from the moment Playback starts", () => {
    const song: Song = { countIn: false, sections: [intro] };
    const beats = beatsBetween(song, { startsAt: 10_000, startSection: 0 }, 0, 20_000);
    expect(beats.map((b) => [b.at, b.count])).toEqual([
      [10_000, "INTRO"],
      [10_500, "2"],
      [11_000, "3"],
      [11_500, "4"],
    ]);
  });

  it("shows the bar number on each later downbeat and moves through Sections at their own tempo", () => {
    const song: Song = {
      countIn: false,
      sections: [
        { ...intro, bars: 2 },
        { sectionType: "Verse", number: 1, bars: 1, beatsPerBar: 3, bpm: 60 },
      ],
    };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    expect(beats.map((b) => [b.at, b.count])).toEqual([
      [0, "INTRO"],
      [500, "2"],
      [1000, "3"],
      [1500, "4"],
      [2000, "2"],
      [2500, "2"],
      [3000, "3"],
      [3500, "4"],
      [4000, "VERSE1"],
      [5000, "2"],
      [6000, "3"],
    ]);
  });

  it("plays a Count-in bar of plain beat numbers before the first Section", () => {
    const song: Song = { countIn: true, sections: [intro] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 2_500);
    expect(beats.map((b) => [b.at, b.count])).toEqual([
      [0, "1"],
      [500, "2"],
      [1000, "3"],
      [1500, "4"],
      [2000, "INTRO"],
    ]);
  });

  it("speaks each Section type on the first beat of the bar before it, then the remaining beats", () => {
    const song: Song = {
      countIn: true,
      sections: [intro, { sectionType: "Verse", number: 1, bars: 1, beatsPerBar: 3, bpm: 60 }],
    };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    expect(beats.map((b) => [b.at, b.voiceCue, b.spokenCount])).toEqual([
      [0, { sectionType: "Intro" }, null],
      [500, null, 2],
      [1000, null, 3],
      [1500, null, 4],
      [2000, { sectionType: "Verse", number: 1 }, null],
      [2500, null, 2],
      [3000, null, 3],
      [3500, null, 4],
      [4000, null, null],
      [5000, null, null],
      [6000, null, null],
    ]);
  });

  it("stays silent before a Section whose Voice cue is switched off", () => {
    const song: Song = {
      countIn: true,
      sections: [{ ...intro, voiceCueEnabled: false }],
    };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 2_000);
    expect(beats.every((b) => b.voiceCue === null && b.spokenCount === null)).toBe(true);
    expect(beats).toHaveLength(4);
  });

  it("plays nothing at or after Stop", () => {
    const song: Song = { countIn: false, sections: [{ ...intro, bars: 4 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0, stopsAt: 1_000 }, 0, 60_000);
    expect(beats.map((b) => b.at)).toEqual([0, 500]);
  });

  it("switches to the Jump target at the Jump instant and announces it in the bar before", () => {
    const song: Song = {
      countIn: false,
      sections: [
        { ...intro, bars: 4 },
        { sectionType: "Verse", number: 1, bars: 2, beatsPerBar: 4, bpm: 120 },
        { sectionType: "Chorus", bars: 2, beatsPerBar: 4, bpm: 120 },
      ],
    };
    const playback = { startsAt: 0, startSection: 0, jumps: [{ at: 4_000, toSection: 2 }] };
    const beats = beatsBetween(song, playback, 2_000, 5_000);
    expect(beats.map((b) => [b.at, b.count, b.voiceCue, b.spokenCount])).toEqual([
      [2_000, "2", { sectionType: "Chorus" }, null],
      [2_500, "2", null, 2],
      [3_000, "3", null, 3],
      [3_500, "4", null, 4],
      [4_000, "CHORUS", null, null],
      [4_500, "2", null, null],
    ]);
  });

  it("accents the Click on every downbeat, Count-in included", () => {
    const song: Song = { countIn: true, sections: [{ ...intro, beatsPerBar: 3 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    expect(beats.map((b) => b.accent)).toEqual([true, false, false, true, false, false]);
  });

  it("tells each beat where it sits in its bar and which Section it belongs to", () => {
    const song: Song = { countIn: true, sections: [{ ...intro, beatsPerBar: 3 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    expect(beats.map((b) => [b.beatInBar, b.beatsPerBar, b.sectionIndex])).toEqual([
      [1, 3, null],
      [2, 3, null],
      [3, 3, null],
      [1, 3, 0],
      [2, 3, 0],
      [3, 3, 0],
    ]);
  });
});

describe("playbackEndsAt", () => {
  const song: Song = { countIn: false, sections: [{ ...intro, bars: 2 }] };

  it("ends when the last bar of the Song finishes", () => {
    expect(playbackEndsAt(song, { startsAt: 10_000, startSection: 0 })).toBe(14_000);
  });

  it("ends at Stop when Stop comes first", () => {
    expect(playbackEndsAt(song, { startsAt: 10_000, startSection: 0, stopsAt: 12_000 })).toBe(12_000);
  });

  it("starts part-way through a Section, counting in at that Section's tempo", () => {
    const song: Song = { countIn: true, sections: [{ ...intro, bars: 4 }, { sectionType: "Verse", bars: 1, beatsPerBar: 4, bpm: 120 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0, startBar: 3 }, 0, 60_000).filter((b) => b.accent);
    expect(beats.map((b) => [b.at, b.count])).toEqual([
      [0, "1"],
      [2_000, "3"],
      [4_000, "4"],
      [6_000, "VERSE"],
    ]);
    expect(playbackEndsAt(song, { startsAt: 0, startSection: 0, startBar: 3 })).toBe(8_000);
  });

  it("announces the Section during a Count-in into a later bar", () => {
    const song: Song = { countIn: true, sections: [{ ...intro, bars: 4 }] };
    const countIn = beatsBetween(song, { startsAt: 0, startSection: 0, startBar: 3 }, 0, 2_000);
    expect(countIn.map((b) => [b.voiceCue, b.spokenCount])).toEqual([
      [{ sectionType: "Intro" }, null],
      [null, 2],
      [null, 3],
      [null, 4],
    ]);
  });
});
