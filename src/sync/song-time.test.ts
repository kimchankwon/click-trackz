import { describe, expect, it } from "vitest";

import { commonTime, markOwnTimes, sameTime, startingSongTime, withSongTime } from "./song-time";

const four = { beatsPerBar: 4, beatUnit: 4 };
const six = { beatsPerBar: 6, beatUnit: 8 };
const threeFour = { beatsPerBar: 3, beatUnit: 4 };

describe("Song time signature", () => {
  it("treats a missing beat unit as quarters", () => {
    expect(sameTime({ beatsPerBar: 4 }, four)).toBe(true);
    expect(sameTime(four, six)).toBe(false);
  });

  it("takes the time signature most Sections use, the first one on a tie", () => {
    expect(commonTime([six, four, { beatsPerBar: 4 }])).toEqual(four);
    expect(commonTime([six, four])).toEqual(six);
    expect(commonTime([])).toBeNull();
  });

  it("starts from the stored Song time signature before guessing from the Sections", () => {
    expect(startingSongTime({ timeSignature: four, sections: [threeFour, threeFour] })).toEqual(four);
    expect(startingSongTime({ sections: [threeFour, threeFour, four] })).toEqual(threeFour);
    expect(startingSongTime({ tempoHint: { beatsPerBar: 6 }, sections: [] })).toEqual({ beatsPerBar: 6, beatUnit: 4 });
    expect(startingSongTime({ sections: [] })).toEqual(four);
  });

  it("keeps stored ownership and only guesses it for Sections saved without it", () => {
    const sections = [
      { ...threeFour, ownTime: true },
      { ...threeFour, ownTime: true },
      { ...four, ownTime: false },
      six,
    ];
    expect(markOwnTimes(sections, four).map((section) => section.ownTime)).toEqual([true, true, false, true]);
  });

  it("gives following Sections the Song time signature and keeps their flags", () => {
    const sections = [
      { ...four, bars: 4, ownTime: false },
      { ...six, bars: 8, ownTime: true },
    ];
    expect(withSongTime(sections, threeFour)).toEqual([
      { beatsPerBar: 3, beatUnit: 4, bars: 4, ownTime: false },
      { ...six, bars: 8, ownTime: true },
    ]);
  });
});
