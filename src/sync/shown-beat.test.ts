import { describe, expect, it } from "vitest";

import { createShownBeat, placeOf, samePlace } from "./shown-beat";
import { beatsBetween, type Jump, type Song } from "./timeline";

const song: Song = {
  countIn: false,
  cueLeadBars: 1,
  sections: [
    { sectionType: "Intro", bars: 2, beatsPerBar: 4, bpm: 120 },
    { sectionType: "Chorus", bars: 2, beatsPerBar: 4, bpm: 120, plays: 2 },
    { sectionType: "Outro", bars: 1, beatsPerBar: 4, bpm: 120 },
  ],
};
const beats = beatsBetween(song, { startsAt: 0, startSection: 0, jumps: [] as Jump[] }, 0, 20_000);

describe("createShownBeat", () => {
  it("tells listeners about each new beat once", () => {
    const shown = createShownBeat();
    const heard: (number | null)[] = [];
    shown.subscribe(() => heard.push(shown.get()?.at ?? null));
    shown.set(beats[0]);
    shown.set(beats[0]);
    shown.set({ ...beats[0] });
    shown.set(beats[1]);
    shown.set(null);
    shown.set(null);
    expect(heard).toEqual([0, 500, null]);
  });

  it("stops telling a listener once it unsubscribes", () => {
    const shown = createShownBeat();
    let calls = 0;
    const unsubscribe = shown.subscribe(() => calls++);
    shown.set(beats[0]);
    unsubscribe();
    shown.set(beats[1]);
    expect(calls).toBe(1);
    expect(shown.get()).toBe(beats[1]);
  });
});

describe("samePlace", () => {
  const changes = (from: number, to: number) => {
    let count = 0;
    for (let index = from + 1; index <= to; index++) if (!samePlace(placeOf(beats[index - 1]), placeOf(beats[index]))) count++;
    return count;
  };

  it("stays the same for every beat of a bar outside a Voice cue lead", () => {
    expect(changes(0, 3)).toBe(0);
  });

  it("changes when a Section, a pass or a Voice cue lead starts, not on every beat", () => {
    const sectionStarts = beats.filter((beat, index) => index > 0 && !samePlace(placeOf(beats[index - 1]), placeOf(beat))).map((beat) => beat.at);
    expect(sectionStarts.length).toBeLessThan(beats.length / 4);
    expect(sectionStarts).toContain(4_000);
    expect(sectionStarts).toContain(8_000);
    expect(sectionStarts).toContain(12_000);
  });

  it("keeps what the Group screen reads from the beat", () => {
    const place = placeOf(beats.find((beat) => beat.at === 4_000) ?? null);
    expect(place).toMatchObject({ sectionIndex: 1, passStartAt: 4_000, beatsPerBar: 4, beatUnit: 4 });
    expect(placeOf(null)).toBeNull();
    expect(samePlace(null, null)).toBe(true);
    expect(samePlace(place, null)).toBe(false);
  });
});
