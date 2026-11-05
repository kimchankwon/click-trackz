import { Asset } from "expo-asset";
import type { AudioBuffer, AudioContext } from "react-native-audio-api";

export async function loadClip(context: AudioContext, source: number | string): Promise<AudioBuffer> {
  const url = typeof source === "string" ? source : Asset.fromModule(source).uri;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load recording (${response.status})`);
  return context.decodeAudioData(await response.arrayBuffer());
}
