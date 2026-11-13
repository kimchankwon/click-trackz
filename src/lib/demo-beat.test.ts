import { describe, expect, it } from "vitest";

import { demoBeatAt, msUntilNextBeat } from "./demo-beat";

describe("demoBeatAt", () => {
  it("counts like Play: the Section on bar 1's downbeat, the bar number on later downbeats, the beat otherwise", () => {
    const counts = Array.from({ length: 16 }, (_, beat) => demoBeatAt(beat * 500).count);
    expect(counts).toEqual(["CHORUS1", "2", "3", "4", "2", "2", "3", "4", "3", "2", "3", "4", "4", "2", "3", "4"]);
  });

  it("loops back to bar 1 after four bars", () => {
    expect(demoBeatAt(16 * 500)).toEqual({ index: 0, bar: 1, beatInBar: 1, count: "CHORUS1" });
    expect(demoBeatAt(17 * 500 + 250).beatInBar).toBe(2);
  });

  it("waits for the next beat from anywhere inside one", () => {
    expect(msUntilNextBeat(0)).toBe(500);
    expect(msUntilNextBeat(1_120)).toBe(380);
  });
});
