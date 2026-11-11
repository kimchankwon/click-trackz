import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";

import { useAppActive } from "./use-app-active";

export const IDLE_AFTER_MS = 10 * 60_000;

export function useIdleWithoutPlayback(playing: boolean, idleAfterMs = IDLE_AFTER_MS): boolean {
  const appActive = useAppActive();
  const focused = useIsFocused();
  const [idle, setIdle] = useState(false);
  const waiting = !playing && appActive && focused;

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setIdle(true), idleAfterMs);
    return () => {
      clearTimeout(timer);
      setIdle(false);
    };
  }, [waiting, idleAfterMs]);

  return idle;
}
