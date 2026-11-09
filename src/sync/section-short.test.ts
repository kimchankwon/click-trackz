import { describe, expect, it } from "vitest";

import { builtinSectionTypes } from "./cue-vocabulary";
import { shortTitleOf } from "./section-short";

describe("shortTitleOf", () => {
  it("shortens built-in Section types and keeps the number", () => {
    expect(shortTitleOf({ sectionType: "Intro", number: 1 })).toBe("Intr1");
    expect(shortTitleOf({ sectionType: "Verse", number: 1 })).toBe("Vs1");
    expect(shortTitleOf({ sectionType: "Pre-Chorus" })).toBe("Pr");
    expect(shortTitleOf({ sectionType: "Interlude" })).toBe("Intl");
    expect(shortTitleOf({ sectionType: "Instrumental" })).toBe("Ins");
  });

  it("puts a space between a short name ending in a full stop and its number", () => {
    expect(shortTitleOf({ sectionType: "Chorus" })).toBe("Ch.");
    expect(shortTitleOf({ sectionType: "Chorus", number: 2 })).toBe("Ch. 2");
    expect(shortTitleOf({ sectionType: "Bridge", number: 1 })).toBe("Br. 1");
  });

  it("gives every built-in Section type its own short name", () => {
    const shorts = builtinSectionTypes.map((sectionType) => shortTitleOf({ sectionType }));
    expect(new Set(shorts).size).toBe(builtinSectionTypes.length);
  });

  it("uses the first two letters of a custom Section type", () => {
    expect(shortTitleOf({ sectionType: "spontaneous", number: 3 })).toBe("Sp3");
    expect(shortTitleOf({ sectionType: "X" })).toBe("X");
    expect(shortTitleOf({ sectionType: "--" })).toBe("?");
    expect(shortTitleOf({ sectionType: "constructor" })).toBe("Co");
    expect(shortTitleOf({ sectionType: "toString", number: 2 })).toBe("To2");
  });
});
