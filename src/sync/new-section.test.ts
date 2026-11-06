import { describe, expect, it } from "vitest";

import { insertAt, newSectionAfter } from "./new-section";
import type { Section } from "./timeline";

const verse: Section = { sectionType: "Verse", number: 1, bars: 16, beatsPerBar: 6, beatUnit: 8, bpm: 138 };

describe("new Sections", () => {
  it("starts a Song with a four-bar Intro at the suggested tempo", () => {
    expect(newSectionAfter(undefined, { bpm: 144, beatsPerBar: 4 })).toEqual({ sectionType: "Intro", bars: 4, beatsPerBar: 4, beatUnit: 4, bpm: 144 });
    expect(newSectionAfter(undefined, null)).toEqual({ sectionType: "Intro", bars: 4, beatsPerBar: 4, beatUnit: 4, bpm: 72 });
  });

  it("follows the tempo and time signature of the Section before it", () => {
    expect(newSectionAfter(verse, { bpm: 90, beatsPerBar: 4 })).toEqual({ sectionType: "Verse", bars: 4, beatsPerBar: 6, beatUnit: 8, bpm: 138 });
  });

  it("inserts between Sections, at the start or at the end", () => {
    expect(insertAt(["a", "c"], 1, "b")).toEqual(["a", "b", "c"]);
    expect(insertAt(["b"], 0, "a")).toEqual(["a", "b"]);
    expect(insertAt(["a"], 1, "b")).toEqual(["a", "b"]);
    expect(insertAt(["a"], 9, "b")).toEqual(["a", "b"]);
  });
});
