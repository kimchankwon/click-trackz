import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import glyphs from "../../../assets/fonts/material-symbols-icons.json";
import { iconSymbols } from "./icon-symbols";

const root = path.resolve(import.meta.dirname, "../../..");
const materialCodepoints: Record<string, number> = JSON.parse(readFileSync(path.join(root, "node_modules/expo-symbols/build/android/symbols.json"), "utf8"));

function fontCodepoints(file: string) {
  const font = readFileSync(file);
  const tables = font.readUInt16BE(4);
  let cmap = -1;
  for (let index = 0; index < tables; index++) {
    const record = 12 + index * 16;
    if (font.toString("latin1", record, record + 4) === "cmap") cmap = font.readUInt32BE(record + 8);
  }
  const codes = new Set<number>();
  for (let index = 0; index < font.readUInt16BE(cmap + 2); index++) {
    const subtable = cmap + font.readUInt32BE(cmap + 4 + index * 8 + 4);
    if (font.readUInt16BE(subtable) !== 4) continue;
    const segments = font.readUInt16BE(subtable + 6) / 2;
    const ends = subtable + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const rangeOffsets = deltas + segments * 2;
    for (let segment = 0; segment < segments; segment++) {
      const end = font.readUInt16BE(ends + segment * 2);
      const start = font.readUInt16BE(starts + segment * 2);
      const delta = font.readUInt16BE(deltas + segment * 2);
      const rangeOffsetAt = rangeOffsets + segment * 2;
      const rangeOffset = font.readUInt16BE(rangeOffsetAt);
      for (let code = start; code <= end && code !== 0xffff; code++) {
        const indexed = rangeOffset === 0 ? code : font.readUInt16BE(rangeOffsetAt + rangeOffset + (code - start) * 2);
        const glyph = rangeOffset !== 0 && indexed === 0 ? 0 : (indexed + delta) & 0xffff;
        if (glyph !== 0) codes.add(code);
      }
    }
  }
  return codes;
}

describe("the web icon font", () => {
  const names = [...new Set(Object.values(iconSymbols).map((symbol) => symbol.material))].sort();

  it("maps exactly the icons the app uses to their Material Symbols codepoints", () => {
    expect(Object.keys(glyphs).sort()).toEqual(names);
    for (const name of names) expect((glyphs as Record<string, number>)[name]).toBe(materialCodepoints[name]);
  });

  it("has a glyph for every icon the app uses", () => {
    const inFont = fontCodepoints(path.join(root, "assets/fonts/material-symbols-icons.ttf"));
    expect(names.filter((name) => !inFont.has(materialCodepoints[name]))).toEqual([]);
  });
});
