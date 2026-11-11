export const FAST_PING_MS = 5_000;
export const STEADY_PING_MS = 10_000;
export const STANDBY_PING_MS = 30_000;
const WARM_UP_MS = 15_000;

export type PingPace = "playback" | "standby" | "paused";

export function pingDelayMs({ sinceOpenMs, hidden, hasEstimate, pace }: { sinceOpenMs: number; hidden: boolean; hasEstimate: boolean; pace: PingPace }): number | null {
  if (hidden || pace === "paused") return null;
  if (!hasEstimate || sinceOpenMs < WARM_UP_MS) return FAST_PING_MS;
  return pace === "playback" ? STEADY_PING_MS : STANDBY_PING_MS;
}
