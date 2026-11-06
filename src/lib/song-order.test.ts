import { describe, expect, it } from "vitest";

import { neighbourSong } from "./song-order";

describe("neighbourSong", () => {
  const order = ["a", "b", "c"];

  it("steps to the previous or next Song in the order", () => {
    expect(neighbourSong(order, "b", -1)).toEqual({ item: "a", at: 0 });
    expect(neighbourSong(order, "b", 1)).toEqual({ item: "c", at: 2 });
  });

  it("stops at either end instead of wrapping", () => {
    expect(neighbourSong(order, "a", -1)).toBeNull();
    expect(neighbourSong(order, "c", 1)).toBeNull();
  });

  it("goes to the first Song when nothing is picked yet", () => {
    expect(neighbourSong(order, null, 1)).toEqual({ item: "a", at: 0 });
    expect(neighbourSong(order, null, -1)).toBeNull();
    expect(neighbourSong([], null, 1)).toBeNull();
  });

  it("walks through a Setlist that plays a Song twice", () => {
    const repeats = ["a", "b", "a", "c"];
    const second = neighbourSong(repeats, "b", 1);
    expect(second).toEqual({ item: "a", at: 2 });
    expect(neighbourSong(repeats, "a", 1, second!.at)).toEqual({ item: "c", at: 3 });
    expect(neighbourSong(repeats, "a", -1, second!.at)).toEqual({ item: "b", at: 1 });
  });

  it("ignores a stale position that no longer holds the Song", () => {
    expect(neighbourSong(order, "c", -1, 0)).toEqual({ item: "b", at: 1 });
  });
});
