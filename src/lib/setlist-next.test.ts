import { describe, expect, it } from "vitest";

import { nextInSetlist } from "./setlist-next";

describe("nextInSetlist", () => {
  const order = ["a", "b", "c", "d"];
  const playable = (item: string) => item !== "b";

  it("gives the next Song that can be played, skipping ones that still need structure", () => {
    expect(nextInSetlist(order, "a", playable)).toBe("c");
    expect(nextInSetlist(order, "c", playable)).toBe("d");
  });

  it("has nothing after the last Song or for a Song outside the Setlist", () => {
    expect(nextInSetlist(order, "d", playable)).toBeNull();
    expect(nextInSetlist(order, "z", playable)).toBeNull();
  });
});
