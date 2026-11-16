import { useEffect } from "react";
import { cancelAnimation, Easing, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import type { Beat } from "@/sync/timeline";

export const FLASH_LOW = 0.35;
const FLASH_MS = 450;

export function useLeadProgress(beat: Beat | null, playing: boolean) {
  const progress = useSharedValue(0);
  const lead = playing ? (beat?.lead ?? null) : null;
  const leading = lead !== null;
  const from = lead ? (lead.beat - 1) / lead.beats : 0;
  const to = lead ? lead.beat / lead.beats : 0;
  const beatMs = beat?.beatMs ?? 0;
  const beatAt = playing ? beat?.at : undefined;
  useEffect(() => {
    if (!leading) {
      progress.set(0);
      return;
    }
    progress.set(from);
    progress.set(withTiming(to, { duration: beatMs, easing: Easing.linear }));
  }, [leading, from, to, beatMs, beatAt, progress]);
  return progress;
}

export function useFlash(on: boolean) {
  const glow = useSharedValue(1);
  useEffect(() => {
    if (!on) {
      cancelAnimation(glow);
      glow.set(1);
      return;
    }
    glow.set(1);
    glow.set(withRepeat(withTiming(FLASH_LOW, { duration: FLASH_MS }), -1, true));
    return () => cancelAnimation(glow);
  }, [on, glow]);
  return glow;
}
