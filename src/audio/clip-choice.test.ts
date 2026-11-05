import { describe, expect, it } from "vitest";

import { chooseClip } from "./clip-choice";

describe("chooseClip", () => {
  it("prefers the Group's own recording, then the Speaker's built-in clip, then silence", () => {
    const uploads = { "chorus-2": "upload:chorus-2", exhortation: "upload:exhortation" };
    const builtin = new Set(["chorus", "chorus-2", "verse"]);
    expect(chooseClip({ sectionType: "Chorus", number: 2 }, uploads, builtin)).toEqual({ source: "upload", ref: "upload:chorus-2" });
    expect(chooseClip({ sectionType: "Chorus", number: 3 }, uploads, builtin)).toEqual({ source: "builtin", ref: "chorus" });
    expect(chooseClip({ sectionType: "Verse" }, uploads, builtin)).toEqual({ source: "builtin", ref: "verse" });
    expect(chooseClip({ sectionType: "Exhortation" }, uploads, builtin)).toEqual({ source: "upload", ref: "upload:exhortation" });
    expect(chooseClip({ sectionType: "Spontaneous" }, uploads, builtin)).toBeNull();
  });

  it("uses the Group's plain-word recording before the Speaker's numbered clip", () => {
    const uploads = { chorus: "upload:chorus" };
    const builtin = new Set(["chorus", "chorus-2"]);
    expect(chooseClip({ sectionType: "Chorus", number: 2 }, uploads, builtin)).toEqual({ source: "upload", ref: "upload:chorus" });
  });
});
