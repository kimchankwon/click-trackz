import { requireOptionalNativeModule } from "expo";
import type { AudioContext } from "react-native-audio-api";
import { monotonicNow } from "@/lib/device-clock";

type OutputLatencyModule = { outputLatencyMs(): number };

const latencyModule = requireOptionalNativeModule<OutputLatencyModule>("OutputLatency");
const REREAD_AFTER_MS = 1_000;

let lastRead: { ms: number | null; at: number } | null = null;

const readNative = (): number | null => {
  try {
    const ms = latencyModule?.outputLatencyMs();
    return ms !== undefined && Number.isFinite(ms) && ms >= 0 ? ms : null;
  } catch {
    return null;
  }
};

export function watchOutput(_context: AudioContext) {}

export function reportedOutputLatencyMs(): number | null {
  if (latencyModule === null) return null;
  const now = monotonicNow();
  if (lastRead === null || now - lastRead.at >= REREAD_AFTER_MS) lastRead = { ms: readNative() ?? lastRead?.ms ?? null, at: now };
  return lastRead.ms;
}
