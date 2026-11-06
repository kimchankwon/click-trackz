import { describe, expect, it } from "vitest";

import { accentIds, accentPalettes, isAccentId, mixHex, type AccentTokens } from "./accents";

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const schemes: [string, "light" | "dark", string][] = [
  ["light", "light", "#FFFFFF"],
  ["dark", "dark", "#000000"],
];

describe("accent palettes", () => {
  it("offers a palette for every accent id and nothing else", () => {
    expect(Object.keys(accentPalettes).sort()).toEqual([...accentIds].sort());
  });

  it("keeps red exactly as the app has always looked", () => {
    expect(accentPalettes.red.light).toEqual({ accent: "#CF3B22", onAccent: "#FFFFFF", accentSoft: "#F8D3CB", accentTint: "#FCEAE5" });
    expect(accentPalettes.red.dark).toEqual({ accent: "#FF6A4D", onAccent: "#000000", accentSoft: "#4A2018", accentTint: "#2E1510" });
  });

  for (const id of accentIds) {
    for (const [name, scheme, background] of schemes) {
      it(`${id} stays readable in ${name} mode`, () => {
        const tokens: AccentTokens = accentPalettes[id][scheme];
        expect(contrast(tokens.onAccent, tokens.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens.accent, background)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("knows which ids are real", () => {
    expect(isAccentId("blue")).toBe(true);
    expect(isAccentId("chartreuse")).toBe(false);
    expect(isAccentId(undefined)).toBe(false);
  });

  it("mixes a colour over its background by weight", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#102030", "#FFFFFF", 1)).toBe("#102030");
    expect(mixHex("#102030", "#FFFFFF", 0)).toBe("#FFFFFF");
  });
});
