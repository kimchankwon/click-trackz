import type { AudioBuffer, AudioContext } from "react-native-audio-api";

export function loadClip(context: AudioContext, source: number | string): Promise<AudioBuffer> {
  return context.decodeAudioData(source);
}
