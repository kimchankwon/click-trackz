export const FAST_PING_MS = 5_000;
export const STEADY_PING_MS = 10_000;
const WARM_UP_MS = 15_000;

export function pingDelayMs({ sinceOpenMs, hidden, hasEstimate }: { sinceOpenMs: number; hidden: boolean; hasEstimate: boolean }): number | null {
  if (hidden) return null;
  return !hasEstimate || sinceOpenMs < WARM_UP_MS ? FAST_PING_MS : STEADY_PING_MS;
}
