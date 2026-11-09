import { describe, expect, it } from "vitest";

import { nextInSetlist, setlistPosition } from "./setlist-next";

describe("nextInSetlist", () => {
  const order = ["a", "b", "c", "d"];
  const playable = (item: string) => item !== "b";

  it("gives the next Song that can be played, skipping ones that still need structure", () => {
    expect(nextInSetlist(order, 0, playable)).toEqual({ item: "c", index: 2 });
    expect(nextInSetlist(order, 2, playable)).toEqual({ item: "d", index: 3 });
  });

  it("has nothing after the last Song", () => {
    expect(nextInSetlist(order, 3, playable)).toBeNull();
  });

  it("follows the position, so a Song that appears twice still reaches the rest of the Setlist", () => {
    const repeats = ["a", "b", "a", "c"];
    expect(nextInSetlist(repeats, 2, () => true)).toEqual({ item: "c", index: 3 });
  });
});

describe("setlistPosition", () => {
  const repeats = ["a", "b", "a", "c"];

  it("keeps a known position while it still holds that Song", () => {
    expect(setlistPosition(repeats, "a", 2)).toBe(2);
  });

  it("falls back to the first place the Song appears when the position is unknown or stale", () => {
    expect(setlistPosition(repeats, "a", null)).toBe(0);
    expect(setlistPosition(repeats, "a", 3)).toBe(0);
    expect(setlistPosition(repeats, "z", 1)).toBeNull();
  });
});
