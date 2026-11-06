import type { Section } from "./timeline";

export type TempoHint = { bpm: number; beatsPerBar: number } | null | undefined;

export function newSectionAfter(previous: Section | undefined, tempoHint: TempoHint): Section {
  return {
    sectionType: previous ? "Verse" : "Intro",
    bars: 4,
    beatsPerBar: previous?.beatsPerBar ?? tempoHint?.beatsPerBar ?? 4,
    beatUnit: previous?.beatUnit ?? 4,
    bpm: previous?.bpm ?? tempoHint?.bpm ?? 72,
  };
}

export function insertAt<T>(items: readonly T[], at: number, item: T): T[] {
  const index = Math.max(0, Math.min(items.length, at));
  return [...items.slice(0, index), item, ...items.slice(index)];
}
