export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function changedOrder<T>(items: readonly T[], from: number, to: number, keyOf: (item: T) => string): T[] | null {
  const next = moveItem(items, from, to);
  return next.every((item, index) => keyOf(item) === keyOf(items[index])) ? null : next;
}

export function slotsWhileDragging(count: number, from: number, to: number): number[] {
  return Array.from({ length: count }, (_, index) => {
    if (index === from) return to;
    if (from < to && index > from && index <= to) return index - 1;
    if (from > to && index >= to && index < from) return index + 1;
    return index;
  });
}

export function dropSlot(from: number, offset: number, step: number, count: number): number {
  if (count === 0 || step <= 0) return from;
  return Math.max(0, Math.min(count - 1, Math.round(from + offset / step)));
}

export function keysWithRepeats(ids: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return ids.map((id) => {
    const nth = seen.get(id) ?? 0;
    seen.set(id, nth + 1);
    return `${id}#${nth}`;
  });
}
