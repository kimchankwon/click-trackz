import { describe, expect, it } from "vitest";

import { draftProblem, sameDraft, sectionWithSongTime, type SongDraft } from "./song-draft";

const verse = { sectionType: "Verse", number: 1, bars: 8, beatsPerBar: 4, bpm: 72, ownTempo: false };

const saved: SongDraft = { title: "Remembrance", key: "E", countIn: true, subdivision: 1, cueLeadBars: 2, bpm: 72, timeSignature: { beatsPerBar: 4, beatUnit: 4 }, sections: [verse] };

describe("sameDraft", () => {
  it("treats spacing and spelled-out defaults as unchanged", () => {
    expect(sameDraft(saved, { ...saved, title: "Remembrance ", key: " E", sections: [{ ...verse, beatUnit: 4, voiceCueEnabled: true, customLabel: "" }] })).toBe(true);
  });

  it("notices a changed Song setting or Section", () => {
    expect(sameDraft(saved, { ...saved, cueLeadBars: 1 })).toBe(false);
    expect(sameDraft(saved, { ...saved, timeSignature: { beatsPerBar: 3, beatUnit: 4 } })).toBe(false);
    expect(sameDraft(saved, { ...saved, sections: [{ ...verse, ownTime: true }] })).toBe(false);
    expect(sameDraft(saved, { ...saved, sections: [{ ...verse, bars: 4 }] })).toBe(false);
    expect(sameDraft(saved, { ...saved, sections: [verse, verse] })).toBe(false);
    expect(sameDraft(saved, { ...saved, sections: [{ ...verse, letter: "A" }] })).toBe(false);
  });
});

describe("draftProblem", () => {
  it("accepts the saved Song", () => {
    expect(draftProblem(saved)).toBeNull();
  });

  it("names the first thing the server would refuse, in order", () => {
    expect(draftProblem({ ...saved, title: "  " })).toBe("Give the Song a title");
    expect(draftProblem({ ...saved, title: "x".repeat(81) })).toBe("Song title must be 80 characters or fewer");
    expect(draftProblem({ ...saved, key: "Ebmaj7/G#" })).toBe("Key must be 8 characters or fewer");
    expect(draftProblem({ ...saved, sections: Array.from({ length: 65 }, () => verse) })).toBe("A Song can have at most 64 Sections");
    expect(draftProblem({ ...saved, bpm: 0 })).toBe("Song tempo must be from 30 to 300 BPM");
    expect(draftProblem({ ...saved, sections: [{ ...verse, bars: 0 }] })).toBe("Section 1: Bars must be a whole number from 1 to 100");
    expect(draftProblem({ ...saved, sections: [verse, { ...verse, bars: 4.5 }] })).toBe("Section 2: Bars must be a whole number from 1 to 100");
    expect(draftProblem({ ...saved, sections: [{ ...verse, ownTempo: true, bpm: 500 }] })).toBe("Section 1: BPM must be from 30 to 300");
    expect(draftProblem({ ...saved, sections: [{ ...verse, ownTempo: false, bpm: 500 }] })).toBeNull();
  });
});

describe("sectionWithSongTime", () => {
  const section = { sectionType: "Verse", bars: 4, beatsPerBar: 4, beatUnit: 4, bpm: 100 };

  it("gives a Section that follows the Song the Song's current time", () => {
    expect(sectionWithSongTime(section, { beatsPerBar: 2, beatUnit: 4 })).toMatchObject({ beatsPerBar: 2, beatUnit: 4 });
  });

  it("keeps a Section's own time", () => {
    expect(sectionWithSongTime({ ...section, beatsPerBar: 6, beatUnit: 8, ownTime: true }, { beatsPerBar: 2, beatUnit: 4 })).toMatchObject({ beatsPerBar: 6, beatUnit: 8 });
  });
});
