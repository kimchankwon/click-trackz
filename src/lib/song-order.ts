export type OrderStep<T> = { item: T; at: number };

export function neighbourSong<T>(order: readonly T[], current: T | null, by: -1 | 1, at: number | null = null): OrderStep<T> | null {
  if (order.length === 0) return null;
  const index = current === null ? -1 : at !== null && order[at] === current ? at : order.indexOf(current);
  if (index === -1) return by === 1 ? { item: order[0], at: 0 } : null;
  const next = index + by;
  return next >= 0 && next < order.length ? { item: order[next], at: next } : null;
}
