import { describe, expect, it } from "vitest";

import { commonTime, markOwnTimes, sameTime, withSongTime } from "./song-time";

const four = { beatsPerBar: 4, beatUnit: 4 };
const six = { beatsPerBar: 6, beatUnit: 8 };

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

  it("marks Sections that differ from the Song as their own", () => {
    expect(markOwnTimes([four, six], four).map((section) => section.ownTime)).toEqual([false, true]);
  });

  it("gives following Sections the Song time signature and keeps their own ones", () => {
    const sections = [
      { ...four, bars: 4, ownTime: false },
      { ...six, bars: 8, ownTime: true },
    ];
    expect(withSongTime(sections, { beatsPerBar: 3, beatUnit: 4 })).toEqual([
      { beatsPerBar: 3, beatUnit: 4, bars: 4 },
      { ...six, bars: 8 },
    ]);
  });
});
