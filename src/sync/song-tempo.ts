export const DEFAULT_BPM = 72;

type Tempo = { bpm: number; ownTempo?: boolean };

export function commonBpm(sections: readonly Tempo[]): number | null {
  const counts = new Map<number, number>();
  for (const section of sections) counts.set(section.bpm, (counts.get(section.bpm) ?? 0) + 1);
  let best: number | null = null;
  for (const [bpm, count] of counts) if (best === null || count > (counts.get(best) ?? 0)) best = bpm;
  return best;
}

export function withSongTempo<S extends Tempo>(sections: readonly S[], songBpm: number): S[] {
  return sections.map((section) => (section.ownTempo ? section : { ...section, bpm: songBpm }));
}

export function markOwnTempos<S extends Tempo>(sections: readonly S[], songBpm: number): S[] {
  return sections.map((section) => (section.ownTempo !== undefined ? section : { ...section, ownTempo: section.bpm !== songBpm }));
}
