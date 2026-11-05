import { describe, expect, it } from "vitest";

import { commandBoundary, type Song } from "./timeline";

const song: Song = {
  countIn: false,
  sections: [
    { sectionType: "Intro", bars: 4, beatsPerBar: 4, bpm: 120 },
    { sectionType: "Verse", number: 1, bars: 2, beatsPerBar: 4, bpm: 120 },
  ],
};
const playback = { startsAt: 0, startSection: 0 };

describe("commandBoundary", () => {
  it("lands a next-bar command on the coming bar line", () => {
    expect(commandBoundary(song, playback, { nowMs: 2_300, minLeadMs: 0, mode: "nextBar" })).toBe(4_000);
  });

  it("skips a bar line that is closer than the minimum lead", () => {
    expect(commandBoundary(song, playback, { nowMs: 2_300, minLeadMs: 2_000, mode: "nextBar" })).toBe(6_000);
  });

  it("lands an end-of-Section command where the next Section starts, or where the Song ends", () => {
    expect(commandBoundary(song, playback, { nowMs: 2_300, minLeadMs: 0, mode: "endOfSection" })).toBe(8_000);
    expect(commandBoundary(song, playback, { nowMs: 9_000, minLeadMs: 0, mode: "endOfSection" })).toBe(12_000);
  });

  it("has no boundary once Playback has stopped or the Song has ended", () => {
    const stopped = { ...playback, stopsAt: 3_000 };
    expect(commandBoundary(song, stopped, { nowMs: 2_300, minLeadMs: 0, mode: "nextBar" })).toBeNull();
    expect(commandBoundary(song, playback, { nowMs: 12_500, minLeadMs: 0, mode: "nextBar" })).toBeNull();
  });

  it("follows the bars of a Jump that is already scheduled", () => {
    const jumped = { ...playback, jumps: [{ at: 2_000, toSection: 1 }] };
    expect(commandBoundary(song, jumped, { nowMs: 2_300, minLeadMs: 0, mode: "endOfSection" })).toBe(6_000);
  });
});
