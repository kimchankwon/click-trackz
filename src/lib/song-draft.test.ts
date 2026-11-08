import { describe, expect, it } from "vitest";

import { sameDraft, type SongDraft } from "./song-draft";

const verse = { sectionType: "Verse", number: 1, bars: 8, beatsPerBar: 4, bpm: 72, ownTempo: false };

const saved: SongDraft = { title: "Remembrance", key: "E", countIn: true, subdivision: 1, cueLeadBars: 2, bpm: 72, sections: [verse] };

describe("sameDraft", () => {
  it("treats spacing and spelled-out defaults as unchanged", () => {
    expect(sameDraft(saved, { ...saved, title: "Remembrance ", key: " E", sections: [{ ...verse, beatUnit: 4, voiceCueEnabled: true, customLabel: "" }] })).toBe(true);
  });

  it("notices a changed Song setting or Section", () => {
    expect(sameDraft(saved, { ...saved, cueLeadBars: 1 })).toBe(false);
    expect(sameDraft(saved, { ...saved, sections: [{ ...verse, bars: 4 }] })).toBe(false);
    expect(sameDraft(saved, { ...saved, sections: [verse, verse] })).toBe(false);
  });
});
