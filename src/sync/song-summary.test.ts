import { describe, expect, it } from "vitest";

import { mainBpm, mainTimeSignature, summaryParts } from "./song-summary";

const bar = (bars: number, beatsPerBar: number, bpm = 72, beatUnit?: number) => ({ bars, beatsPerBar, bpm, ...(beatUnit ? { beatUnit } : {}) });

describe("song summary", () => {
  it("names the time signature that covers the most bars", () => {
    expect(mainTimeSignature([bar(8, 4), bar(2, 3), bar(2, 3), bar(16, 4)])).toBe("4/4");
    expect(mainTimeSignature([bar(1, 4), bar(8, 6, 72, 8)])).toBe("6/8");
    expect(mainTimeSignature([])).toBeNull();
  });

  it("keeps the first one when two cover the same bars", () => {
    expect(mainTimeSignature([bar(4, 3), bar(4, 4)])).toBe("3/4");
  });

  it("uses the Song tempo, or the tempo that covers the most bars for a Song saved without one", () => {
    expect(mainBpm({ bpm: 128, sections: [bar(8, 4, 90)] })).toBe(128);
    expect(mainBpm({ sections: [bar(2, 4, 90), bar(16, 4, 72), bar(4, 4, 90)] })).toBe(72);
    expect(mainBpm({ sections: [] })).toBeNull();
  });

  it("shows the parts it knows, and spells out the Key for screen readers", () => {
    expect(summaryParts({ key: "D", timeSignature: "4/4", bpm: 71.6 })).toEqual({ shown: ["D", "4/4", "72 BPM"], spoken: ["Key of D", "4/4", "72 BPM"] });
    expect(summaryParts({ key: null, timeSignature: null, bpm: null })).toEqual({ shown: [], spoken: [] });
  });
});
