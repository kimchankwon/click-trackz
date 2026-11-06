import type { VoiceCue } from "@/sync/timeline";

export const wordKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function chooseClip(cue: VoiceCue, builtin: ReadonlySet<string>): string | null {
  const base = wordKey(cue.sectionType);
  const candidates = cue.number === undefined ? [base] : [`${base}-${cue.number}`, base];
  return candidates.find((key) => builtin.has(key)) ?? null;
}
