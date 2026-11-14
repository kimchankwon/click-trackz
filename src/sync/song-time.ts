import type { Section } from "./timeline";

export type TimeSignature = Pick<Section, "beatsPerBar" | "beatUnit">;

type Timed = TimeSignature & { ownTime?: boolean };

export const DEFAULT_TIME: TimeSignature = { beatsPerBar: 4, beatUnit: 4 };

export const sameTime = (a: TimeSignature, b: TimeSignature) => a.beatsPerBar === b.beatsPerBar && (a.beatUnit ?? 4) === (b.beatUnit ?? 4);

export function commonTime(sections: readonly TimeSignature[]): TimeSignature | null {
  const counts: { time: TimeSignature; count: number }[] = [];
  for (const section of sections) {
    const found = counts.find((entry) => sameTime(entry.time, section));
    if (found) found.count += 1;
    else counts.push({ time: { beatsPerBar: section.beatsPerBar, beatUnit: section.beatUnit ?? 4 }, count: 1 });
  }
  return counts.reduce<{ time: TimeSignature; count: number } | null>((best, entry) => (best === null || entry.count > best.count ? entry : best), null)?.time ?? null;
}

export function markOwnTimes<S extends TimeSignature>(sections: readonly S[], songTime: TimeSignature): (S & { ownTime: boolean })[] {
  return sections.map((section) => ({ ...section, ownTime: !sameTime(section, songTime) }));
}

export function withSongTime<S extends Timed>(sections: readonly S[], songTime: TimeSignature): Omit<S, "ownTime">[] {
  return sections.map(({ ownTime, ...section }) => (ownTime ? section : { ...section, beatsPerBar: songTime.beatsPerBar, beatUnit: songTime.beatUnit ?? 4 }));
}
