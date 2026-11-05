import { builtinVoiceClips, speakers, type BuiltinClipKey, type SpeakerId } from "./builtin-voice-clips";

export const defaultSpeaker: SpeakerId = "adam";

export const isSpeakerId = (value: string): value is SpeakerId => speakers.some((speaker) => speaker.id === value);

const isClipKey = (key: string): key is BuiltinClipKey => key in builtinVoiceClips[defaultSpeaker];

export function clipKeyForSpokenCount(count: number): BuiltinClipKey | null {
  const key = `count-${count}`;
  return isClipKey(key) ? key : null;
}

export const allClipKeys = Object.keys(builtinVoiceClips[defaultSpeaker]) as BuiltinClipKey[];
