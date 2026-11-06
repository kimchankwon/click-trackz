export const WEAK_PING_MS = 80;
export const BAD_PING_MS = 150;

export type PingQuality = "good" | "weak" | "bad";

export const pingQuality = (roundTripMs: number): PingQuality =>
  roundTripMs > BAD_PING_MS ? "bad" : roundTripMs > WEAK_PING_MS ? "weak" : "good";
