import { builtinVoiceClips, speakers, voiceSpeeds, type BuiltinClipKey, type SpeakerId, type VoiceSpeed } from "./builtin-voice-clips";

export const defaultSpeaker: SpeakerId = "adam";

export const defaultVoiceSpeed: VoiceSpeed = "faster";

export const isVoiceSpeed = (value: string): value is VoiceSpeed => voiceSpeeds.some((speed) => speed === value);

export const isSpeakerId = (value: string): value is SpeakerId => speakers.some((speaker) => speaker.id === value);

const isClipKey = (key: string): key is BuiltinClipKey => key in builtinVoiceClips[defaultVoiceSpeed][defaultSpeaker];

export function clipKeyForSpokenCount(count: number): BuiltinClipKey | null {
  const key = `count-${count}`;
  return isClipKey(key) ? key : null;
}

export const allClipKeys = Object.keys(builtinVoiceClips[defaultVoiceSpeed][defaultSpeaker]) as BuiltinClipKey[];
