import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { iconSymbols } from "../src/components/ui/icon-symbols.ts";

const root = path.resolve(import.meta.dirname, "..");
const symbolsPackage = path.join(root, "node_modules", "expo-symbols", "build", "android", "symbols.json");
const fullFont = path.join(root, "node_modules", "@expo-google-fonts", "material-symbols", "400Regular", "MaterialSymbols_400Regular.ttf");
const outDir = path.join(root, "assets", "fonts");

const codepoints: Record<string, number> = JSON.parse(readFileSync(symbolsPackage, "utf8"));
const names = [...new Set(Object.values(iconSymbols).map((symbol) => symbol.material))].sort();
const glyphs = Object.fromEntries(
  names.map((name) => {
    const code = codepoints[name];
    if (code === undefined) throw new Error(`Material Symbols has no glyph named ${name}`);
    return [name, code];
  }),
);

writeFileSync(path.join(outDir, "material-symbols-icons.json"), `${JSON.stringify(glyphs, null, 2)}\n`);
execFileSync(
  "python3",
  [
    "-m",
    "fontTools.subset",
    fullFont,
    `--unicodes=${Object.values(glyphs)
      .map((code) => code.toString(16))
      .join(",")}`,
    "--layout-features=",
    "--name-IDs=*",
    "--notdef-outline",
    `--output-file=${path.join(outDir, "material-symbols-icons.ttf")}`,
  ],
  { stdio: "inherit" },
);
console.log(`${names.length} icons written to ${path.relative(root, outDir)}`);
