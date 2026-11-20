export const LATENCY_NUDGE_KEY = "latencyNudgeMs";
export const LATENCY_MIN_MS = -100;
export const LATENCY_MAX_MS = 400;

const isLatencySetting = (value: string): value is string =>
  /^-?\d{1,3}$/.test(value) && Number(value) >= LATENCY_MIN_MS && Number(value) <= LATENCY_MAX_MS;

export const clampLatency = (ms: number) => Math.round(Math.min(LATENCY_MAX_MS, Math.max(LATENCY_MIN_MS, ms)));

export const SHOWN_NUDGE_MIN_MS = -LATENCY_MAX_MS;
export const SHOWN_NUDGE_MAX_MS = -LATENCY_MIN_MS;

export const nudgeShown = (nudgeMs: number) => (nudgeMs === 0 ? 0 : -nudgeMs);

export const nudgeFromShown = (shownMs: number) => clampLatency(shownMs === 0 ? 0 : -shownMs);

const MINUS = "\u2212";

export const signedNumber = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `${MINUS}${-value}` : "0");

export const signedMs = (ms: number) => `${signedNumber(ms)} ms`;

export const nudgeText = (nudgeMs: number) => signedMs(nudgeShown(nudgeMs));

export const latencyNudgeKeyFor = (outputId: string | null) =>
  outputId === null ? LATENCY_NUDGE_KEY : `${LATENCY_NUDGE_KEY}.${outputId.replace(/[^A-Za-z0-9.-]/gu, (char) => `_${char.codePointAt(0)!.toString(16)}_`)}`;

export type OutputNudge = { nudgeMs: number; savedForOutput: boolean };

export function outputNudge(outputId: string | null, read: (key: string) => string | null): OutputNudge {
  const valid = (key: string) => {
    const stored = read(key);
    return stored !== null && isLatencySetting(stored) ? Number(stored) : null;
  };
  const own = valid(latencyNudgeKeyFor(outputId));
  if (own !== null) return { nudgeMs: own, savedForOutput: outputId !== null };
  return { nudgeMs: outputId === null ? 0 : (valid(LATENCY_NUDGE_KEY) ?? 0), savedForOutput: false };
}
