import { describe, expect, it } from "vitest";

import { sectionProgressAt, sectionProgressFrom } from "./section-progress";

describe("sectionProgressAt", () => {
  it("fills across the whole Section one beat at a time", () => {
    const pass = { beatMs: 2_000, passMs: 128_000 };
    expect(sectionProgressAt({ ...pass, msIntoPass: 0 })).toEqual({ from: 0, to: 1 / 64 });
    expect(sectionProgressAt({ ...pass, msIntoPass: 68_000 })).toEqual({ from: 34 / 64, to: 35 / 64 });
    expect(sectionProgressAt({ ...pass, msIntoPass: 126_000 })).toEqual({ from: 63 / 64, to: 1 });
  });

  it("gives a shorter bar a shorter share, so a bar of 2/4 fills half as far as a bar of 4/4", () => {
    expect(sectionProgressAt({ beatMs: 500, passMs: 5_000, msIntoPass: 4_000 })).toEqual({ from: 0.8, to: 0.9 });
  });
});

describe("sectionProgressFrom", () => {
  const beat = { at: 10_000, beatMs: 2_000, passMs: 128_000, msIntoPass: 0 };

  it("starts at the beat when it has only just sounded", () => {
    expect(sectionProgressFrom(beat, 10_000)).toEqual({ start: 0, to: 1 / 64, durationMs: 2_000 });
  });

  it("picks up partway through a beat that a Member joins late", () => {
    expect(sectionProgressFrom(beat, 11_500)).toEqual({ start: 0.75 / 64, to: 1 / 64, durationMs: 500 });
  });

  it("stays inside the beat when the clock is unknown, early or past it", () => {
    expect(sectionProgressFrom(beat, null)).toEqual({ start: 0, to: 1 / 64, durationMs: 2_000 });
    expect(sectionProgressFrom(beat, 9_000)).toEqual({ start: 0, to: 1 / 64, durationMs: 2_000 });
    expect(sectionProgressFrom(beat, 13_000)).toEqual({ start: 1 / 64, to: 1 / 64, durationMs: 0 });
  });
});
