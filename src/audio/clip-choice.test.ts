import { describe, expect, it } from "vitest";

import { chooseClip } from "./clip-choice";

describe("chooseClip", () => {
  const builtin = new Set(["chorus", "chorus-2", "verse", "pre-chorus"]);

  it("uses the numbered clip when there is one, then the plain word", () => {
    expect(chooseClip({ sectionType: "Chorus", number: 2 }, builtin)).toBe("chorus-2");
    expect(chooseClip({ sectionType: "Chorus", number: 3 }, builtin)).toBe("chorus");
    expect(chooseClip({ sectionType: "Pre-Chorus" }, builtin)).toBe("pre-chorus");
  });

  it("speaks the number without the letter", () => {
    expect(chooseClip({ sectionType: "Chorus", number: 2, letter: "A" }, builtin)).toBe("chorus-2");
  });

  it("has nothing for a word without a clip", () => {
    expect(chooseClip({ sectionType: "Spontaneous" }, builtin)).toBeNull();
  });
});
