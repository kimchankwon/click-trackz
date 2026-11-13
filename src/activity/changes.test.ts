import { describe, expect, it } from "vitest";

import { capDetails, MAX_DETAILS, sectionName, setlistChanges, songChanges, type ChangedSong } from "./changes";

const song: ChangedSong = {
  title: "Pure",
  key: "G",
  countIn: true,
  bpm: 72,
  sections: [
    { sectionType: "Intro", bars: 4, beatsPerBar: 4, bpm: 72 },
    { sectionType: "Verse", number: 1, bars: 8, beatsPerBar: 4, bpm: 72 },
    { sectionType: "Chorus", bars: 8, beatsPerBar: 4, bpm: 72 },
  ],
};

describe("songChanges", () => {
  it("finds nothing when nothing changed", () => {
    expect(songChanges(song, { ...song })).toEqual([]);
  });

  it("names each Song setting that changed, from and to", () => {
    expect(songChanges(song, { ...song, title: "Pure Heart", key: undefined, bpm: 76, countIn: false, subdivision: 2, cueLeadBars: 1 })).toEqual([
      "Title: Pure → Pure Heart",
      "Key: G → none",
      "Song tempo: 72 BPM → 76 BPM",
      "Count-in: on → off",
      "Clicks per beat: 1 → 2",
      "Cue lead: 2 bars → 1 bar",
    ]);
  });

  it("names the Sections added and removed, and where", () => {
    const [intro, verse, chorus] = song.sections;
    const bridge = { sectionType: "Bridge", bars: 4, beatsPerBar: 4, bpm: 72 };
    expect(songChanges(song, { ...song, sections: [intro, chorus, bridge] })).toEqual(["Removed Section 2: Verse 1", "Added Section 3: Bridge"]);
    expect(songChanges(song, { ...song, sections: [verse, intro, chorus] })).toEqual(["Moved Intro from Section 1 to Section 2"]);
  });

  it("names what changed inside a Section", () => {
    const [intro, verse, chorus] = song.sections;
    const edited = {
      ...verse,
      bars: 16,
      beatsPerBar: 6,
      beatUnit: 8,
      ownTempo: true,
      bpm: 80,
      voiceCueEnabled: false,
      plays: 2,
      customLabel: "Quiet verse",
      timeChanges: [{ bar: 4, bars: 1, beatsPerBar: 2, beatUnit: 4 }],
    };
    expect(songChanges(song, { ...song, sections: [intro, edited, chorus] })).toEqual([
      "Section 2 Quiet verse: Custom label: none → Quiet verse",
      "Section 2 Quiet verse: Bars: 8 → 16",
      "Section 2 Quiet verse: Time signature: 4/4 → 6/8",
      "Section 2 Quiet verse: Tempo: Song tempo → 80 BPM",
      "Section 2 Quiet verse: Voice cue: on → off",
      "Section 2 Quiet verse: Plays: 1 → 2",
      "Section 2 Quiet verse: Time changes: none → 2/4 at bar 4 for 1 bar",
    ]);
  });

  it("reads a Song with no Song tempo by its most common Section tempo", () => {
    const legacy: ChangedSong = {
      ...song,
      bpm: undefined,
      sections: [
        { sectionType: "Verse", number: 1, bars: 8, beatsPerBar: 4, bpm: 72 },
        { sectionType: "Chorus", bars: 8, beatsPerBar: 4, bpm: 72 },
        { sectionType: "Bridge", bars: 4, beatsPerBar: 4, bpm: 80 },
      ],
    };
    const saved = { ...legacy, title: "Pure Heart", bpm: 72, sections: legacy.sections.map((section) => ({ ...section, ownTempo: section.bpm !== 72 })) };
    expect(songChanges(legacy, saved)).toEqual(["Title: Pure → Pure Heart"]);
    const [verse, chorus, bridge] = saved.sections;
    expect(songChanges(legacy, { ...saved, title: "Pure", sections: [verse, chorus, { ...bridge, bpm: 84 }] })).toEqual([
      "Section 3 Bridge: Tempo: 80 BPM → 84 BPM",
    ]);
  });

  it("notices a Section tempo change in a Song that still has no Song tempo", () => {
    const solo: ChangedSong = { title: "Pure", countIn: true, sections: [{ sectionType: "Verse", bars: 8, beatsPerBar: 4, bpm: 80 }] };
    expect(songChanges(solo, { ...solo, sections: [{ ...solo.sections[0], bpm: 90 }] })).toEqual(["Song tempo: 80 BPM → 90 BPM"]);
  });

  it("pairs repeated Sections with the copy that did not change", () => {
    const short = { sectionType: "Verse", bars: 4, beatsPerBar: 4, bpm: 72 };
    const long = { ...short, bars: 8 };
    const chorus = song.sections[2];
    const repeats = { ...song, sections: [short, chorus, long] };
    expect(songChanges(repeats, { ...repeats, sections: [chorus, long] })).toEqual(["Removed Section 1: Verse"]);
    expect(songChanges(repeats, { ...repeats, sections: [long, short, chorus] })).toEqual(["Moved Verse from Section 3 to Section 1"]);
    expect(songChanges(repeats, { ...repeats, sections: [short, chorus, { ...long, bars: 12 }] })).toEqual(["Section 3 Verse: Bars: 8 → 12"]);
  });

  it("reads a renumbered Section as a new one", () => {
    const [intro, verse, chorus] = song.sections;
    expect(songChanges(song, { ...song, sections: [intro, { ...verse, number: 2 }, chorus] })).toEqual([
      "Removed Section 2: Verse 1",
      "Added Section 2: Verse 2",
    ]);
  });
});

describe("sectionName", () => {
  it("prefers the Custom label", () => {
    expect(sectionName({ sectionType: "Verse", number: 2 })).toBe("Verse 2");
    expect(sectionName({ sectionType: "Verse", customLabel: " Tag " })).toBe("Tag");
  });
});

describe("setlistChanges", () => {
  const titles: Record<string, string> = { a: "Pure", b: "Promises", c: "Holy" };
  const titleOf = (songId: string) => titles[songId];

  it("names the Songs added, removed and moved, and Key and Leader changes", () => {
    const before = { name: "Sunday", entries: [{ songId: "a", key: "G" }, { songId: "b" }, { songId: "c" }] };
    const after = { name: "Sunday PM", entries: [{ songId: "c" }, { songId: "a", key: "A", leader: "Sam" }] };
    expect(setlistChanges(before, after, titleOf)).toEqual([
      "Name: Sunday → Sunday PM",
      "Removed Promises",
      "Moved Pure to number 2",
      "Pure: Key: G → A",
      "Pure: Leader: none → Sam",
    ]);
  });

  it("finds nothing when nothing changed", () => {
    const setlist = { name: "Sunday", entries: [{ songId: "a" }] };
    expect(setlistChanges(setlist, { ...setlist, entries: [{ songId: "a", key: " " }] }, titleOf)).toEqual([]);
  });

  it("pairs a repeated Song with the copy that did not change", () => {
    const before = { name: "x", entries: [{ songId: "a", key: "G" }, { songId: "b" }, { songId: "a", key: "A", leader: "Sam" }] };
    expect(setlistChanges(before, { ...before, entries: [before.entries[1], before.entries[2]] }, titleOf)).toEqual(["Removed Pure"]);
    expect(setlistChanges(before, { ...before, entries: [before.entries[2], before.entries[0], before.entries[1]] }, titleOf)).toEqual([
      "Moved Pure to number 1",
    ]);
  });

  it("numbers an added Song", () => {
    expect(setlistChanges({ name: "x", entries: [] }, { name: "x", entries: [{ songId: "b" }] }, titleOf)).toEqual(["Added Promises as number 1"]);
  });
});

describe("capDetails", () => {
  it("keeps short lists and sums up the rest of long ones", () => {
    expect(capDetails(["a"])).toEqual(["a"]);
    const long = Array.from({ length: MAX_DETAILS + 5 }, (_, i) => `line ${i}`);
    const capped = capDetails(long);
    expect(capped).toHaveLength(MAX_DETAILS);
    expect(capped.at(-1)).toBe("And 6 more changes");
  });
});
