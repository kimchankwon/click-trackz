import type { Section } from "./timeline";

const builtinShort = new Map<string, string>(Object.entries({
  Intro: "Intr",
  Verse: "Vs",
  "Pre-Chorus": "Pr",
  Chorus: "Ch.",
  "Post-Chorus": "Po",
  Bridge: "Br.",
  Interlude: "Intl",
  Turnaround: "Ta",
  Instrumental: "Ins",
  Solo: "S",
  Tag: "T",
  Vamp: "Va",
  Breakdown: "Bd",
  Build: "Bu",
  Outro: "O",
  Ending: "E",
}));

function shortType(sectionType: string): string {
  const builtin = builtinShort.get(sectionType);
  if (builtin) return builtin;
  const letters = Array.from(sectionType.replace(/[^\p{L}\p{N}]/gu, ""));
  if (letters.length === 0) return "?";
  return letters[0].toUpperCase() + (letters[1] ?? "").toLowerCase();
}

export function shortTitleOf(section: Pick<Section, "sectionType" | "number">): string {
  const short = shortType(section.sectionType);
  if (section.number === undefined) return short;
  return short.endsWith(".") ? `${short} ${section.number}` : `${short}${section.number}`;
}
