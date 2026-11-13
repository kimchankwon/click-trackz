export const ROUND_TRIP_BURST = 3;
export const ROUND_TRIP_REFRESH_MS = 60_000;
export const ROUND_TRIP_KEEP = 3;

export const keepRecent = (roundTrips: readonly number[], next: number, keep = ROUND_TRIP_KEEP) => [...roundTrips, next].filter((ms) => ms >= 0).slice(-keep);

export const bestOf = (roundTrips: readonly number[]) => (roundTrips.length === 0 ? null : Math.min(...roundTrips));
