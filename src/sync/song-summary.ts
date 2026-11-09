import { playsOf, timeSignatureOf, type Section } from "./timeline";

type SummarySection = Pick<Section, "bars" | "beatsPerBar" | "beatUnit" | "bpm" | "plays">;

function mostBars<T>(sections: readonly SummarySection[], valueOf: (section: SummarySection) => T): T | null {
  const bars = new Map<T, number>();
  for (const section of sections) bars.set(valueOf(section), (bars.get(valueOf(section)) ?? 0) + section.bars * playsOf(section));
  let best: T | null = null;
  for (const [value, count] of bars) if (best === null || count > (bars.get(best) ?? 0)) best = value;
  return best;
}

export const mainTimeSignature = (sections: readonly SummarySection[]) => mostBars(sections, timeSignatureOf);

export const mainBpm = (song: { bpm?: number; sections: readonly SummarySection[] }) => song.bpm ?? mostBars(song.sections, (section) => section.bpm);

export function summaryParts(summary: { key: string | null; timeSignature: string | null; bpm: number | null }) {
  return {
    shown: [summary.key, summary.timeSignature, summary.bpm === null ? null : `${Math.round(summary.bpm)} BPM`].filter((part): part is string => part !== null),
    spoken: [summary.key ? `Key of ${summary.key}` : null, summary.timeSignature, summary.bpm === null ? null : `${Math.round(summary.bpm)} BPM`].filter(
      (part): part is string => part !== null,
    ),
  };
}
