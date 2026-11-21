import type { Section } from "./timeline";

type TempoHint = { bpm: number; beatsPerBar: number } | null | undefined;

const FOLLOWING_TYPE: ReadonlyMap<string, string> = new Map([
  ["Intro", "Verse"],
  ["Verse", "Chorus"],
  ["Pre-Chorus", "Chorus"],
  ["Chorus", "Verse"],
  ["Post-Chorus", "Verse"],
  ["Bridge", "Chorus"],
  ["Interlude", "Verse"],
  ["Turnaround", "Verse"],
  ["Instrumental", "Verse"],
  ["Solo", "Chorus"],
  ["Tag", "Outro"],
  ["Vamp", "Outro"],
  ["Breakdown", "Build"],
  ["Build", "Chorus"],
  ["Outro", "Ending"],
  ["Ending", "Ending"],
]);

export const sectionTypeAfter = (previous: string | undefined) => (previous === undefined ? "Intro" : (FOLLOWING_TYPE.get(previous) ?? "Verse"));

export function newSectionAfter(previous: Section | undefined, tempoHint: TempoHint): Section {
  return {
    sectionType: sectionTypeAfter(previous?.sectionType),
    bars: previous?.bars ?? 4,
    beatsPerBar: previous?.beatsPerBar ?? tempoHint?.beatsPerBar ?? 4,
    beatUnit: previous?.beatUnit ?? 4,
    bpm: previous?.bpm ?? tempoHint?.bpm ?? 72,
  };
}

export function insertAt<T>(items: readonly T[], at: number, item: T): T[] {
  const index = Math.max(0, Math.min(items.length, at));
  return [...items.slice(0, index), item, ...items.slice(index)];
}
