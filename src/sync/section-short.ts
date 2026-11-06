import type { Section } from "./timeline";

const builtinShort: Record<string, string> = {
  Intro: "I",
  Verse: "V",
  "Pre-Chorus": "Pr",
  Chorus: "C",
  "Post-Chorus": "Po",
  Bridge: "B",
  Interlude: "In",
  Turnaround: "Ta",
  Instrumental: "Is",
  Solo: "S",
  Tag: "T",
  Vamp: "Va",
  Breakdown: "Bd",
  Build: "Bu",
  Outro: "O",
  Ending: "E",
};

function shortType(sectionType: string): string {
  const builtin = builtinShort[sectionType];
  if (builtin) return builtin;
  const letters = Array.from(sectionType.replace(/[^\p{L}\p{N}]/gu, ""));
  if (letters.length === 0) return "?";
  return letters[0].toUpperCase() + (letters[1] ?? "").toLowerCase();
}

export const shortTitleOf = (section: Pick<Section, "sectionType" | "number">) =>
  `${shortType(section.sectionType)}${section.number ?? ""}`;
