export const LATENCY_MIN_MS = -100;
export const LATENCY_MAX_MS = 400;

export const isLatencySetting = (value: string): value is string =>
  /^-?\d{1,3}$/.test(value) && Number(value) >= LATENCY_MIN_MS && Number(value) <= LATENCY_MAX_MS;

export const clampLatency = (ms: number) => Math.round(Math.min(LATENCY_MAX_MS, Math.max(LATENCY_MIN_MS, ms)));
