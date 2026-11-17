import { useEffect } from "react";
import { useSharedValue } from "react-native-reanimated";

import { beatPhase } from "@/lib/timing-test";

export function useServerBeatPhase(firstBeatAt: number | null, intervalMs: number, serverNow: () => number | null) {
  const phase = useSharedValue(-1);
  useEffect(() => {
    if (firstBeatAt === null) {
      phase.set(-1);
      return;
    }
    let frame = 0;
    const draw = () => {
      const now = serverNow();
      phase.set(now === null ? -1 : beatPhase(now, firstBeatAt, intervalMs));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      phase.set(-1);
    };
  }, [firstBeatAt, intervalMs, serverNow, phase]);
  return phase;
}
