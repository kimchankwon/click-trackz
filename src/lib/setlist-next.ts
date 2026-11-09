export function nextInSetlist<T>(order: readonly T[], current: T, playable: (item: T) => boolean): T | null {
  const index = order.indexOf(current);
  if (index < 0) return null;
  return order.slice(index + 1).find(playable) ?? null;
}
