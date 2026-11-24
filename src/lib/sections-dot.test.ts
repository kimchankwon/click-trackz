import { describe, expect, it } from "vitest";

import { anySectionsDot, showsSectionsDot } from "./sections-dot";

describe("No Sections dot", () => {
  it("shows beside the line under the title", () => {
    expect(showsSectionsDot(true, ["Led by Jisue"])).toBe(true);
  });

  it("is hidden when the row has no line for it to sit on", () => {
    expect(showsSectionsDot(true, [])).toBe(false);
  });

  it("is hidden for a Song that has Sections", () => {
    expect(showsSectionsDot(false, ["Led by Jisue"])).toBe(false);
  });

  it("keeps the legend only while some row shows the dot", () => {
    expect(anySectionsDot([{ needsStructure: true, leader: "Jisue" }, { needsStructure: false, leader: null }])).toBe(true);
    expect(anySectionsDot([{ needsStructure: true, leader: null }, { needsStructure: false, leader: "Jason" }])).toBe(false);
  });
});
