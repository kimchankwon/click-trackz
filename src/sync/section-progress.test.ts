import { describe, expect, it } from "vitest";

import { sectionProgressAt, sectionProgressFrom } from "./section-progress";

describe("sectionProgressAt", () => {
  it("fills across the whole Section one beat at a time", () => {
    expect(sectionProgressAt({ beatInBar: 1, beatsPerBar: 4, barInSection: 1, barsInSection: 16 })).toEqual({ from: 0, to: 1 / 64 });
    expect(sectionProgressAt({ beatInBar: 3, beatsPerBar: 4, barInSection: 9, barsInSection: 16 })).toEqual({ from: 34 / 64, to: 35 / 64 });
    expect(sectionProgressAt({ beatInBar: 4, beatsPerBar: 4, barInSection: 16, barsInSection: 16 })).toEqual({ from: 63 / 64, to: 1 });
  });
});

describe("sectionProgressFrom", () => {
  const beat = { at: 10_000, beatMs: 2_000, beatInBar: 1, beatsPerBar: 4, barInSection: 1, barsInSection: 16 };

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
