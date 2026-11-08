import { describe, expect, it } from "vitest";

import { beatGroupSize, beatsBetween, offbeatsOf, playbackEndsAt, subdivisionOf, timeSignatureOf, type Song } from "./timeline";

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

  it("plays two Count-in bars of plain beat numbers before the first Section", () => {
    const song: Song = { countIn: true, sections: [intro] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 4_500);
    expect(beats.map((b) => [b.at, b.count])).toEqual([
      [0, "1"],
      [500, "2"],
      [1000, "3"],
      [1500, "4"],
      [2000, "1"],
      [2500, "2"],
      [3000, "3"],
      [3500, "4"],
      [4000, "INTRO"],
    ]);
  });

  it("speaks each Section type over the two bars before it at half time, Count-in included", () => {
    const song: Song = {
      countIn: true,
      sections: [{ ...intro, bars: 2 }, { sectionType: "Chorus", bars: 1, beatsPerBar: 4, bpm: 120 }],
    };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    const spoken = (b: (typeof beats)[number]) => (b.voiceCue ? b.voiceCue.sectionType.toUpperCase() : b.spokenCount === null ? "." : String(b.spokenCount));
    expect(beats.map(spoken).join(" ")).toBe("INTRO . 2 . 3 . 4 . CHORUS . 2 . 3 . 4 . . . . .");
  });

  it("speaks once per group of three in compound meters", () => {
    const verse = { sectionType: "Verse", bars: 2, beatsPerBar: 6, beatUnit: 8, bpm: 180 };
    const song: Song = { countIn: false, sections: [verse, { ...verse, sectionType: "Chorus", bars: 1 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000).slice(0, 12);
    expect(beats.map((b) => b.voiceCue?.sectionType ?? b.spokenCount ?? ".").join(" ")).toBe("Chorus . . 2 . . 3 . . 4 . .");
  });

  it("plays a one-bar Count-in and speaks each Section type on every beat of the one bar before it when the Cue lead is one bar", () => {
    const song: Song = {
      countIn: true,
      cueLeadBars: 1,
      sections: [{ ...intro, bars: 2 }, { sectionType: "Chorus", bars: 1, beatsPerBar: 4, bpm: 120 }],
    };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    const spoken = (b: (typeof beats)[number]) => (b.voiceCue ? b.voiceCue.sectionType.toUpperCase() : b.spokenCount === null ? "." : String(b.spokenCount));
    expect(beats.map(spoken).join(" ")).toBe("INTRO 2 3 4 . . . . CHORUS 2 3 4 . . . .");
    expect(beats.slice(0, 5).map((b) => [b.at, b.count, b.barsInSection])).toEqual([
      [0, "1", 1],
      [500, "2", 1],
      [1000, "3", 1],
      [1500, "4", 1],
      [2000, "INTRO", 2],
    ]);
    expect(beats[8].lead).toEqual({ cue: { sectionType: "Chorus" }, barsLeft: 1, beat: 1, beats: 4 });
    expect(beats[7].lead).toBeNull();
  });

  it("still speaks once per group of three in compound meters when the Cue lead is one bar", () => {
    const verse = { sectionType: "Verse", bars: 2, beatsPerBar: 6, beatUnit: 8, bpm: 180 };
    const song: Song = { countIn: false, cueLeadBars: 1, sections: [verse, { ...verse, sectionType: "Chorus", bars: 1 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000).slice(0, 12);
    expect(beats.map((b) => b.voiceCue?.sectionType ?? b.spokenCount ?? ".").join(" ")).toBe(". . . . . . Chorus . . 2 . .");
  });

  it("gives a cue only the one bar there is when the Section before is one bar long", () => {
    const song: Song = {
      countIn: false,
      sections: [{ ...intro, bars: 2 }, { sectionType: "Tag", bars: 1, beatsPerBar: 4, bpm: 120 }, { sectionType: "Outro", bars: 1, beatsPerBar: 4, bpm: 120 }],
    };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    const spoken = (b: (typeof beats)[number]) => b.voiceCue?.sectionType ?? (b.spokenCount === null ? "." : String(b.spokenCount));
    expect(beats.map(spoken).join(" ")).toBe("Tag . 2 . 3 . 4 . Outro . 2 . . . . .");
  });

  it("tells each lead-in beat the coming cue, how many bars are left and how far through it is", () => {
    const song: Song = { countIn: false, sections: [{ ...intro, bars: 2 }, { sectionType: "Chorus", bars: 1, beatsPerBar: 4, bpm: 120 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    expect(beats[0].lead).toEqual({ cue: { sectionType: "Chorus" }, barsLeft: 2, beat: 1, beats: 8 });
    expect(beats[7].lead).toEqual({ cue: { sectionType: "Chorus" }, barsLeft: 1, beat: 8, beats: 8 });
    expect(beats[8].lead).toEqual({ cue: null, barsLeft: 1, beat: 1, beats: 4 });
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

  it("switches to the Jump target at the Jump instant and announces it in the two bars before", () => {
    const song: Song = {
      countIn: false,
      sections: [
        { ...intro, bars: 4 },
        { sectionType: "Verse", number: 1, bars: 2, beatsPerBar: 4, bpm: 120 },
        { sectionType: "Chorus", bars: 2, beatsPerBar: 4, bpm: 120 },
      ],
    };
    const playback = { startsAt: 0, startSection: 0, jumps: [{ at: 4_000, toSection: 2 }] };
    const beats = beatsBetween(song, playback, 0, 5_000);
    expect(beats.map((b) => [b.at, b.count, b.voiceCue, b.spokenCount])).toEqual([
      [0, "INTRO", { sectionType: "Chorus" }, null],
      [500, "2", null, null],
      [1_000, "3", null, 2],
      [1_500, "4", null, null],
      [2_000, "2", null, 3],
      [2_500, "2", null, null],
      [3_000, "3", null, 4],
      [3_500, "4", null, null],
      [4_000, "CHORUS", null, null],
      [4_500, "2", null, null],
    ]);
  });

  it("accents the Click on every downbeat, Count-in included", () => {
    const song: Song = { countIn: true, sections: [{ ...intro, beatsPerBar: 3 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    expect(beats.map((b) => b.accent)).toEqual([true, false, false, true, false, false, true, false, false]);
  });

  it("tells each beat where it sits in its bar and which Section it belongs to", () => {
    const song: Song = { countIn: true, sections: [{ ...intro, beatsPerBar: 3 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 60_000);
    expect(beats.map((b) => [b.beatInBar, b.beatsPerBar, b.sectionIndex])).toEqual([
      [1, 3, null],
      [2, 3, null],
      [3, 3, null],
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
      [2_000, "1"],
      [4_000, "3"],
      [6_000, "4"],
      [8_000, "VERSE"],
    ]);
    expect(playbackEndsAt(song, { startsAt: 0, startSection: 0, startBar: 3 })).toBe(10_000);
  });

  it("announces the Section during a Count-in into a later bar", () => {
    const song: Song = { countIn: true, sections: [{ ...intro, bars: 4 }] };
    const countIn = beatsBetween(song, { startsAt: 0, startSection: 0, startBar: 3 }, 0, 4_000);
    expect(countIn.map((b) => b.voiceCue?.sectionType ?? b.spokenCount ?? ".").join(" ")).toBe("Intro . 2 . 3 . 4 .");
  });
});

describe("time signatures", () => {
  it("counts every written beat in 6/8 and marks where each group of three starts", () => {
    const song: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 1, beatsPerBar: 6, beatUnit: 8, bpm: 180 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0 }, 0, 10_000);
    expect(beats.map((b) => [b.at, b.count, b.accent, b.groupStart])).toEqual([
      [0, "VERSE", true, false],
      [333.3333333333333, "2", false, false],
      [666.6666666666666, "3", false, false],
      [1000, "4", false, true],
      [1333.3333333333333, "5", false, false],
      [1666.6666666666665, "6", false, false],
    ]);
    expect(beats.every((b) => b.beatUnit === 8)).toBe(true);
  });

  it("groups compound meters in threes and leaves simple meters whole", () => {
    expect(beatGroupSize(6, 8)).toBe(3);
    expect(beatGroupSize(9, 8)).toBe(3);
    expect(beatGroupSize(12, 8)).toBe(3);
    expect(beatGroupSize(3, 8)).toBe(3);
    expect(beatGroupSize(7, 8)).toBe(7);
    expect(beatGroupSize(6, 4)).toBe(6);
    expect(beatGroupSize(4)).toBe(4);
  });

  it("names the time signature, assuming quarter notes when none is stored", () => {
    expect(timeSignatureOf({ beatsPerBar: 6, beatUnit: 8 })).toBe("6/8");
    expect(timeSignatureOf({ beatsPerBar: 3 })).toBe("3/4");
  });
});

describe("section progress", () => {
  it("tells each beat which bar of its Section it is in, and how long a beat lasts", () => {
    const song: Song = { countIn: true, sections: [{ ...intro, bars: 3 }] };
    const beats = beatsBetween(song, { startsAt: 0, startSection: 0, startBar: 2 }, 0, 60_000).filter((b) => b.accent);
    expect(beats.map((b) => [b.sectionIndex, b.barInSection, b.barsInSection, b.beatMs])).toEqual([
      [null, 1, 2, 500],
      [null, 2, 2, 500],
      [0, 2, 3, 500],
      [0, 3, 3, 500],
    ]);
  });
});

describe("late Jumps", () => {
  it("names the Jump target on the first word still to come, keeping the count", () => {
    const song: Song = {
      countIn: false,
      sections: [
        { ...intro, bars: 4 },
        { sectionType: "Chorus", bars: 2, beatsPerBar: 4, bpm: 120 },
      ],
    };
    const playback = { startsAt: 0, startSection: 0, jumps: [{ at: 4_000, toSection: 1, cueFrom: 2_500 }] };
    const beats = beatsBetween(song, playback, 0, 4_000);
    const said = (cueFrom: number) =>
      beatsBetween(song, { ...playback, jumps: [{ ...playback.jumps[0], cueFrom }] }, 0, 4_000)
        .map((b) => b.voiceCue?.sectionType ?? b.spokenCount ?? ".")
        .join(" ");
    expect(beats.at(-2)?.voiceCue).toEqual({ sectionType: "Chorus" });
    expect(said(2_500)).toBe(". . . . . . Chorus .");
    expect(said(1_500)).toBe(". . . . Chorus . 4 .");
    expect(said(-Infinity)).toBe("Chorus . 2 . 3 . 4 .");
  });
});

describe("Subdivision", () => {
  it("splits each beat evenly into the Song's Clicks per beat", () => {
    expect(offbeatsOf({ at: 1_000, beatMs: 600 }, 1)).toEqual([]);
    expect(offbeatsOf({ at: 1_000, beatMs: 600 }, 2)).toEqual([1_300]);
    expect(offbeatsOf({ at: 1_000, beatMs: 600 }, 3)).toEqual([1_200, 1_400]);
  });

  it("plays one Click per beat unless the Song asks for 2, 3 or 4", () => {
    expect([undefined, 1, 2, 3, 4, 5, 0, 2.5].map((subdivision) => subdivisionOf({ subdivision }))).toEqual([1, 1, 2, 3, 4, 1, 1, 1]);
  });

  it("leaves the beats, their accents and the counts unchanged", () => {
    const waltz: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 1, beatsPerBar: 3, bpm: 60 }] };
    const plain = beatsBetween(waltz, { startsAt: 0, startSection: 0 }, 0, 60_000);
    expect(beatsBetween({ ...waltz, subdivision: 2 }, { startsAt: 0, startSection: 0 }, 0, 60_000)).toEqual(plain);
    expect(plain.flatMap((beat) => [beat.accent ? `${beat.beatInBar}!` : String(beat.beatInBar), ...offbeatsOf(beat, 2).map(() => ".")]).join(" ")).toBe("1! . 2 . 3 .");
  });
});
