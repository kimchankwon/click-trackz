export const MAX_SONG_TITLE = 80;
export const MAX_GROUP_NAME = 40;

export type Copied = { title: string; copyBase?: string | null };

export function copyBaseOf({ title, copyBase }: Copied): string {
  const trimmed = title.trim();
  if (!copyBase) return trimmed;
  const numbered = trimmed.slice(copyBase.length);
  return trimmed.toLowerCase().startsWith(copyBase.toLowerCase()) && /^ \d+$/.test(numbered) ? copyBase : trimmed;
}

export function copyTitle(base: string, taken: readonly string[], maxLength = MAX_SONG_TITLE): string {
  const used = new Set(taken.map((existing) => existing.trim().toLowerCase()));
  for (let copy = 2; ; copy++) {
    const suffix = ` ${copy}`;
    const candidate = `${base.slice(0, maxLength - suffix.length).trimEnd()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
