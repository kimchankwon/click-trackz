export const FAST_PING_MS = 5_000;
export const SLOW_PING_MS = 60_000;
const WARM_UP_MS = 30_000;

export function pingDelayMs({ sinceOpenMs, fast, hidden }: { sinceOpenMs: number; fast: boolean; hidden: boolean }): number | null {
  if (hidden) return null;
  return fast || sinceOpenMs < WARM_UP_MS ? FAST_PING_MS : SLOW_PING_MS;
}
