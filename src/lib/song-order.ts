export function neighbourSong<T>(order: readonly T[], current: T | null, by: -1 | 1): T | null {
  if (order.length === 0) return null;
  const index = current === null ? -1 : order.indexOf(current);
  if (index === -1) return by === 1 ? order[0] : null;
  return order[index + by] ?? null;
}
