import { requireOptionalNativeModule } from "expo";
import type { AudioContext } from "react-native-audio-api";

type OutputLatencyModule = { outputLatencyMs(): number };

const latencyModule = requireOptionalNativeModule<OutputLatencyModule>("OutputLatency");
const REREAD_AFTER_MS = 1_000;

let lastRead: { ms: number; at: number } | null = null;

const readNative = (): number | null => {
  try {
    const ms = latencyModule?.outputLatencyMs();
    return ms !== undefined && Number.isFinite(ms) && ms >= 0 ? ms : null;
  } catch {
    return null;
  }
};

export function outputLatencyMs(_context: AudioContext): number {
  if (latencyModule === null) return 0;
  const now = performance.now();
  if (lastRead === null || now - lastRead.at >= REREAD_AFTER_MS) lastRead = { ms: readNative() ?? lastRead?.ms ?? 0, at: now };
  return lastRead.ms;
}
