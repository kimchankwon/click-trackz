import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";

import { useAppActive } from "./use-app-active";

export const IDLE_AFTER_MS = 10 * 60_000;

export function useIdleWithoutPlayback(playing: boolean, idleAfterMs = IDLE_AFTER_MS): boolean {
  const appActive = useAppActive();
  const focused = useIsFocused();
  const [quiet, setQuiet] = useState(false);
  const watching = appActive && focused;

  useEffect(() => {
    if (!playing && !watching) return;
    const wake = setTimeout(() => setQuiet(false), 0);
    if (playing) return () => clearTimeout(wake);
    const sleep = setTimeout(() => setQuiet(true), idleAfterMs);
    return () => {
      clearTimeout(wake);
      clearTimeout(sleep);
    };
  }, [playing, watching, idleAfterMs]);

  return quiet && !playing;
}
