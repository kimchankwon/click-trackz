import { describe, expect, it } from "vitest";

import { centredScrollY, sectionListHeight } from "./section-list";

describe("Section list", () => {
  it("is as tall as its rows, up to five", () => {
    expect(sectionListHeight(1)).toBe(40);
    expect(sectionListHeight(3)).toBe(128);
    expect(sectionListHeight(5)).toBe(216);
    expect(sectionListHeight(12)).toBe(216);
  });

  it("scrolls so the focused row sits in the middle, without running past either end", () => {
    const view = sectionListHeight(12);
    expect(centredScrollY(0, view, 12)).toBe(0);
    expect(centredScrollY(5, view, 12)).toBe(5 * 44 + 20 - 108);
    expect(centredScrollY(11, view, 12)).toBe(12 * 40 + 11 * 4 - view);
    expect(centredScrollY(2, sectionListHeight(3), 3)).toBe(0);
  });

  it("can rest halfway between the current row and the next", () => {
    const view = sectionListHeight(12);
    expect(centredScrollY(5.5, view, 12)).toBe(5.5 * 44 + 20 - 108);
  });
});
