import type { AudioContext } from "react-native-audio-api";

type BrowserLatency = { baseLatency?: number; outputLatency?: number };

export function outputLatencyMs(context: AudioContext): number {
  const browser = (context as unknown as { context?: BrowserLatency }).context;
  return ((browser?.baseLatency ?? 0) + (browser?.outputLatency ?? 0)) * 1000;
}
