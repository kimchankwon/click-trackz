import { describe, expect, it } from "vitest";

import { addTap, MAX_TAPS, tappedBpm } from "./tap-tempo";

const tapsEvery = (ms: number, count: number, from = 0) => Array.from({ length: count }, (_, index) => from + index * ms).reduce<number[]>(addTap, []);

describe("tap tempo", () => {
  it("needs two taps, then averages every gap", () => {
    expect(tappedBpm(tapsEvery(500, 1))).toBeNull();
    expect(tappedBpm(tapsEvery(500, 2))).toBe(120);
    expect(tappedBpm([0, 480, 1_010, 1_500])).toBe(120);
  });

  it("keeps only the latest taps, so a tempo change takes over", () => {
    const taps = [...tapsEvery(1_000, 4), ...tapsEvery(500, MAX_TAPS, 3_500)].reduce<number[]>(addTap, []);
    expect(taps).toHaveLength(MAX_TAPS);
    expect(tappedBpm(taps)).toBe(120);
  });

  it("starts again after a pause of more than two seconds", () => {
    const taps = [0, 500, 1_000, 3_500].reduce<number[]>(addTap, []);
    expect(taps).toEqual([3_500]);
    expect(tappedBpm(taps)).toBeNull();
  });

  it("stays within the tempos a Song can have", () => {
    expect(tappedBpm([0, 100])).toBe(300);
    expect(tappedBpm([0, 1_900, 3_800])).toBe(32);
  });
});
