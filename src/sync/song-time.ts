import type { Section } from "./timeline";

export type TimeSignature = Pick<Section, "beatsPerBar" | "beatUnit">;
export type SongTimeSignature = { beatsPerBar: number; beatUnit: number };

type Timed = TimeSignature & { ownTime?: boolean };

export const DEFAULT_TIME: SongTimeSignature = { beatsPerBar: 4, beatUnit: 4 };

export const sameTime = (a: TimeSignature, b: TimeSignature) => a.beatsPerBar === b.beatsPerBar && (a.beatUnit ?? 4) === (b.beatUnit ?? 4);

const songTimeOf = (time: TimeSignature): SongTimeSignature => ({ beatsPerBar: time.beatsPerBar, beatUnit: time.beatUnit ?? 4 });

export function commonTime(sections: readonly TimeSignature[]): SongTimeSignature | null {
  const counts: { time: SongTimeSignature; count: number }[] = [];
  for (const section of sections) {
    const found = counts.find((entry) => sameTime(entry.time, section));
    if (found) found.count += 1;
    else counts.push({ time: songTimeOf(section), count: 1 });
  }
  return counts.reduce<{ time: SongTimeSignature; count: number } | null>((best, entry) => (best === null || entry.count > best.count ? entry : best), null)?.time ?? null;
}

type TimedSong = { timeSignature?: SongTimeSignature | null; tempoHint?: { beatsPerBar: number } | null; sections: readonly TimeSignature[] };

export const startingSongTime = (song: TimedSong): SongTimeSignature =>
  song.timeSignature ?? commonTime(song.sections) ?? (song.tempoHint ? { beatsPerBar: song.tempoHint.beatsPerBar, beatUnit: 4 } : DEFAULT_TIME);

export function markOwnTimes<S extends Timed>(sections: readonly S[], songTime: TimeSignature): (S & { ownTime: boolean })[] {
  return sections.map((section) => ({ ...section, ownTime: section.ownTime ?? !sameTime(section, songTime) }));
}

export function withSongTime<S extends Timed>(sections: readonly S[], songTime: TimeSignature): S[] {
  return sections.map((section) => (section.ownTime ? section : { ...section, beatsPerBar: songTime.beatsPerBar, beatUnit: songTime.beatUnit ?? 4 }));
}
