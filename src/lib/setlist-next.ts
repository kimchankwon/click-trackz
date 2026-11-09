export function setlistPosition<T>(order: readonly T[], item: T, hint: number | null | undefined): number | null {
  if (hint !== null && hint !== undefined && order[hint] === item) return hint;
  const index = order.indexOf(item);
  return index < 0 ? null : index;
}

export function nextInSetlist<T>(order: readonly T[], position: number, playable: (item: T) => boolean): { item: T; index: number } | null {
  for (let index = position + 1; index < order.length; index++) if (playable(order[index])) return { item: order[index], index };
  return null;
}

export function startedFromSetlist(playback: { setlistIndex?: number | null }): boolean {
  return playback.setlistIndex !== null && playback.setlistIndex !== undefined;
}
