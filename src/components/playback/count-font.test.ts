import { describe, expect, it } from "vitest";

import { countFontSize, EM_PER_CHARACTER, MAX_COUNT_FONT } from "./count-font";

const TEXT_WIDTH = 141;
const measuredEm = {
  web: { digit: 0.446, widestWord: 0.582, fallbackDigit: 0.637 },
  ios: { digit: 0.637, widestWord: 0.686 },
};

const widthOf = (label: string, em: number, platform: keyof typeof EM_PER_CHARACTER) =>
  label.length * em * countFontSize(label, TEXT_WIDTH, EM_PER_CHARACTER[platform]);

describe("countFontSize", () => {
  it("keeps a single beat number at full size", () => {
    expect(countFontSize("4", TEXT_WIDTH, EM_PER_CHARACTER.ios)).toBe(MAX_COUNT_FONT);
    expect(countFontSize("4", TEXT_WIDTH, EM_PER_CHARACTER.web)).toBe(MAX_COUNT_FONT);
  });

  it("shrinks two-digit bar numbers so they fit the circle on iOS", () => {
    for (const label of ["10", "12", "88"]) {
      expect(countFontSize(label, TEXT_WIDTH, EM_PER_CHARACTER.ios)).toBeLessThan(MAX_COUNT_FONT);
      expect(widthOf(label, measuredEm.ios.digit, "ios")).toBeLessThanOrEqual(TEXT_WIDTH);
    }
  });

  it("fits two-digit bar numbers on the web even before Archivo Narrow loads", () => {
    expect(widthOf("88", measuredEm.web.digit, "web")).toBeLessThanOrEqual(TEXT_WIDTH);
    expect(widthOf("88", measuredEm.web.fallbackDigit, "web")).toBeLessThanOrEqual(TEXT_WIDTH);
  });

  it("fits three-digit bar numbers and long Section names", () => {
    expect(widthOf("100", measuredEm.ios.digit, "ios")).toBeLessThanOrEqual(TEXT_WIDTH);
    expect(widthOf("CHORUS", measuredEm.ios.widestWord, "ios")).toBeLessThanOrEqual(TEXT_WIDTH);
    expect(widthOf("CHORUS", measuredEm.web.widestWord, "web")).toBeLessThanOrEqual(TEXT_WIDTH);
  });
});
