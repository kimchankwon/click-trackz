export const DEMO_BEAT_MS = 500;
export const DEMO_BEATS_PER_BAR = 4;
export const DEMO_BARS = 4;
export const DEMO_SECTION = "CHORUS1";

export type DemoBeat = { index: number; bar: number; beatInBar: number; count: string };

const LOOP = DEMO_BEATS_PER_BAR * DEMO_BARS;

export function demoBeatAt(elapsedMs: number, beatMs = DEMO_BEAT_MS): DemoBeat {
  const index = ((Math.floor(Math.max(0, elapsedMs) / beatMs) % LOOP) + LOOP) % LOOP;
  const bar = Math.floor(index / DEMO_BEATS_PER_BAR) + 1;
  const beatInBar = (index % DEMO_BEATS_PER_BAR) + 1;
  const count = beatInBar > 1 ? String(beatInBar) : bar === 1 ? DEMO_SECTION : String(bar);
  return { index, bar, beatInBar, count };
}

export const msUntilNextBeat = (elapsedMs: number, beatMs = DEMO_BEAT_MS) => beatMs - (Math.max(0, elapsedMs) % beatMs);
