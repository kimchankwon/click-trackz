import type { VoiceCue } from "@/sync/timeline";

export type ClipChoice = { source: "upload" | "builtin"; ref: string };

export const wordKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function chooseClip(
  cue: VoiceCue,
  uploads: Readonly<Record<string, string>>,
  builtin: ReadonlySet<string>,
): ClipChoice | null {
  const base = wordKey(cue.sectionType);
  const candidates = cue.number === undefined ? [base] : [`${base}-${cue.number}`, base];
  const uploaded = candidates.find((key) => uploads[key]);
  if (uploaded) return { source: "upload", ref: uploads[uploaded] };
  const builtinKey = candidates.find((key) => builtin.has(key));
  return builtinKey ? { source: "builtin", ref: builtinKey } : null;
}
