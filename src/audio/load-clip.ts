import type { AudioBuffer, AudioContext } from "react-native-audio-api";

export function loadClip(context: AudioContext, assetModule: number): Promise<AudioBuffer> {
  return context.decodeAudioData(assetModule);
}
