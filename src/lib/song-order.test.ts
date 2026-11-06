import { describe, expect, it } from "vitest";

import { neighbourSong } from "./song-order";

describe("neighbourSong", () => {
  const order = ["a", "b", "c"];

  it("steps to the previous or next Song in the order", () => {
    expect(neighbourSong(order, "b", -1)).toBe("a");
    expect(neighbourSong(order, "b", 1)).toBe("c");
  });

  it("stops at either end instead of wrapping", () => {
    expect(neighbourSong(order, "a", -1)).toBeNull();
    expect(neighbourSong(order, "c", 1)).toBeNull();
  });

  it("goes to the first Song when nothing is picked yet", () => {
    expect(neighbourSong(order, null, 1)).toBe("a");
    expect(neighbourSong(order, null, -1)).toBeNull();
    expect(neighbourSong([], null, 1)).toBeNull();
  });
});
