import { describe, expect, it } from "vitest";

import { swipeStep } from "./swipe-step";

describe("swipeStep", () => {
  it("moves to the next tab on a swipe left and the previous tab on a swipe right", () => {
    expect(swipeStep(-80, 0)).toBe(1);
    expect(swipeStep(80, 0)).toBe(-1);
  });

  it("counts a short fast flick", () => {
    expect(swipeStep(-20, -900)).toBe(1);
    expect(swipeStep(20, 900)).toBe(-1);
  });

  it("stays on the tab for a short slow drag", () => {
    expect(swipeStep(-40, -100)).toBe(0);
    expect(swipeStep(30, 200)).toBe(0);
  });
});
