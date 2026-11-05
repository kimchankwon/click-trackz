import { Asset } from "expo-asset";
import type { AudioBuffer, AudioContext } from "react-native-audio-api";

export async function loadClip(context: AudioContext, assetModule: number): Promise<AudioBuffer> {
  const asset = Asset.fromModule(assetModule);
  const response = await fetch(asset.uri);
  return context.decodeAudioData(await response.arrayBuffer());
}
