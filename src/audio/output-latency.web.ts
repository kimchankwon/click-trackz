import type { AudioContext } from "react-native-audio-api";

type BrowserLatency = { baseLatency?: number; outputLatency?: number };

let watched: AudioContext | null = null;

export function watchOutput(context: AudioContext) {
  watched = context;
}

export function reportedOutputLatencyMs(): number | null {
  if (watched === null || watched.state === "closed") return null;
  const browser = (watched as unknown as { context?: BrowserLatency }).context;
  const ms = ((browser?.baseLatency ?? 0) + (browser?.outputLatency ?? 0)) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}
