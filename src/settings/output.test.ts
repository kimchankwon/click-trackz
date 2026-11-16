import { describe, expect, it } from "vitest";

import { isSide, panOf } from "./output";

describe("stereo side", () => {
  it("pans hard left, hard right or keeps the centre", () => {
    expect([panOf("left"), panOf("both"), panOf("right")]).toEqual([-1, 0, 1]);
  });

  it("only accepts the three sides", () => {
    expect(["left", "both", "right", "centre", ""].map(isSide)).toEqual([true, true, true, false, false]);
  });
});
