import { requireOptionalNativeModule } from "expo";
import type { AudioContext } from "react-native-audio-api";

type OutputLatencyModule = { outputLatencyMs(): number };

const latencyModule = requireOptionalNativeModule<OutputLatencyModule>("OutputLatency");
const REREAD_AFTER_MS = 1_000;

let lastRead: { ms: number; at: number } | null = null;

const readNative = (): number => {
  try {
    const ms = latencyModule?.outputLatencyMs() ?? 0;
    return Number.isFinite(ms) && ms > 0 ? ms : 0;
  } catch {
    return 0;
  }
};

export function outputLatencyMs(_context: AudioContext): number {
  if (latencyModule === null) return 0;
  const now = performance.now();
  if (lastRead === null || now - lastRead.at >= REREAD_AFTER_MS) lastRead = { ms: readNative(), at: now };
  return lastRead.ms;
}
