export const MAX_SONG_TITLE = 80;

const numbered = /^(.*\S) (\d+)$/;

export function copyTitle(title: string, taken: readonly string[]): string {
  const used = new Set(taken.map((existing) => existing.trim().toLowerCase()));
  const trimmed = title.trim();
  const match = numbered.exec(trimmed);
  const base = match && used.has(match[1].toLowerCase()) ? match[1] : trimmed;
  for (let copy = 2; ; copy++) {
    const suffix = ` ${copy}`;
    const candidate = `${base.slice(0, MAX_SONG_TITLE - suffix.length).trimEnd()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}
