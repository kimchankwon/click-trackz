import { describe, expect, it } from "vitest";

import { cuePattern } from "./cue-pattern";

describe("cuePattern", () => {
  it("spells a two-bar Cue lead at half time", () => {
    expect(cuePattern({ beatsPerBar: 4 }, 2)).toBe("CHORUS . 2 . | 3 . 4 .");
  });

  it("spells a one-bar Cue lead on every beat", () => {
    expect(cuePattern({ beatsPerBar: 4 }, 1)).toBe("CHORUS 2 3 4");
    expect(cuePattern({ beatsPerBar: 3 }, 1)).toBe("CHORUS 2 3");
  });

  it("keeps compound meters to one word per group of three", () => {
    expect(cuePattern({ beatsPerBar: 6, beatUnit: 8 }, 1)).toBe("CHORUS . . 2 . .");
  });
});
