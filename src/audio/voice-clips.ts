import type { VoiceCue } from "@/sync/timeline";

import { builtinVoiceClips, type BuiltinClipKey } from "./builtin-voice-clips";

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const isClipKey = (key: string): key is BuiltinClipKey => key in builtinVoiceClips;

export function clipKeyForVoiceCue(cue: VoiceCue): BuiltinClipKey | null {
  const base = slug(cue.sectionType);
  const numbered = cue.number === undefined ? null : `${base}-${cue.number}`;
  if (numbered && isClipKey(numbered)) return numbered;
  return isClipKey(base) ? base : null;
}

export function clipKeyForSpokenCount(count: number): BuiltinClipKey | null {
  const key = `count-${count}`;
  return isClipKey(key) ? key : null;
}

export const allClipKeys = Object.keys(builtinVoiceClips) as BuiltinClipKey[];
