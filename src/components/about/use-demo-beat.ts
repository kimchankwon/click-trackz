import { useSyncExternalStore } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { DEMO_BEAT_MS, DEMO_BEATS_PER_BAR, demoBeatAt, msUntilNextBeat, type DemoBeat } from "@/lib/demo-beat";

const listeners = new Set<() => void>();
const startedAt = performance.now();
export const demoClockStartedAt = startedAt;
let current: DemoBeat = demoBeatAt(0);
let timer: ReturnType<typeof setTimeout> | null = null;

function tick() {
  const elapsed = performance.now() - startedAt;
  current = demoBeatAt(elapsed);
  listeners.forEach((listener) => listener());
  timer = setTimeout(tick, msUntilNextBeat(elapsed));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) timer = setTimeout(tick, msUntilNextBeat(performance.now() - startedAt));
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

const STILL = demoBeatAt(0);
const noSubscription = () => () => undefined;

export function useDemoBeat(): DemoBeat {
  const still = useReducedMotion();
  return useSyncExternalStore(still ? noSubscription : subscribe, () => (still ? STILL : current), () => STILL);
}

export const DEMO_BAR_MS = DEMO_BEAT_MS * DEMO_BEATS_PER_BAR;

export const demoBarPhase = () => ((performance.now() - startedAt) % DEMO_BAR_MS) / DEMO_BAR_MS;
