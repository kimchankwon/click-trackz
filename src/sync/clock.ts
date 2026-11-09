export type ClockSample = {
  sentAt: number;
  serverAt: number;
  receivedAt: number;
};

export type ClockEstimate = {
  offsetMs: number;
  uncertaintyMs: number;
  roundTripMs: number;
};

const roundTripOf = (sample: ClockSample) => sample.receivedAt - sample.sentAt;

export const SLEEP_TOLERANCE_MS = 100;

export const clockSlept = (epochBefore: number, epochNow: number, toleranceMs = SLEEP_TOLERANCE_MS) => Math.abs(epochNow - epochBefore) > toleranceMs;

export function estimateClockOffset(samples: readonly ClockSample[]): ClockEstimate | null {
  const usable = samples.filter((sample) => roundTripOf(sample) >= 0);
  if (usable.length === 0) return null;
  const best = usable.reduce((a, b) => (roundTripOf(b) < roundTripOf(a) ? b : a));
  return {
    offsetMs: best.serverAt - (best.sentAt + best.receivedAt) / 2,
    uncertaintyMs: roundTripOf(best) / 2,
    roundTripMs: roundTripOf(best),
  };
}
