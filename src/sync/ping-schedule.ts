export const FAST_PING_MS = 5_000;
export const SLOW_PING_MS = 60_000;
const WARM_UP_MS = 30_000;

export function holdsClockSteady({ playing, hasEstimate }: { playing: boolean; hasEstimate: boolean }) {
  return playing && hasEstimate;
}

export function pingDelayMs({
  sinceOpenMs,
  playing,
  hidden,
  hasEstimate,
}: {
  sinceOpenMs: number;
  playing: boolean;
  hidden: boolean;
  hasEstimate: boolean;
}): number | null {
  if (hidden || holdsClockSteady({ playing, hasEstimate })) return null;
  return !hasEstimate || sinceOpenMs < WARM_UP_MS ? FAST_PING_MS : SLOW_PING_MS;
}
