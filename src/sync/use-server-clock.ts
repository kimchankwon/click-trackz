import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { api } from "../../convex/_generated/api";
import { estimateClockOffset, type ClockEstimate, type ClockSample } from "./clock";
import { pingDelayMs } from "./ping-schedule";

const INITIAL_BURST = 8;
const WAKE_BURST = 4;
const SAMPLE_WINDOW = 12;
const SAMPLES_BEFORE_READY = 4;

const clientNow = () => performance.now();
const isHidden = () => AppState.currentState !== "active";

export type ServerClock = {
  estimate: ClockEstimate | null;
  serverNow: () => number | null;
};

export function useServerClock({ fast = false }: { fast?: boolean } = {}): ServerClock {
  const ping = useMutation(api.clock.now);
  const [estimate, setEstimate] = useState<ClockEstimate | null>(null);
  const fastRef = useRef(fast);
  const rescheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fastRef.current = fast;
    rescheduleRef.current?.();
  }, [fast]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const openedAt = clientNow();
    const samples: ClockSample[] = [];
    const sampleOnce = async () => {
      const sentAt = clientNow();
      const serverAt = await ping({});
      const receivedAt = clientNow();
      if (cancelled) return;
      samples.push({ sentAt, serverAt, receivedAt });
      if (samples.length > SAMPLE_WINDOW) samples.shift();
      if (samples.length >= SAMPLES_BEFORE_READY) setEstimate(estimateClockOffset(samples));
    };
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (cancelled) return;
      const delay = pingDelayMs({ sinceOpenMs: clientNow() - openedAt, fast: fastRef.current, hidden: isHidden() });
      if (delay === null) return;
      timer = setTimeout(() => {
        void sampleOnce()
          .catch(() => undefined)
          .finally(schedule);
      }, delay);
    };
    const burst = async (count: number) => {
      for (let i = 0; i < count && !cancelled; i++) await sampleOnce().catch(() => undefined);
      schedule();
    };
    rescheduleRef.current = schedule;
    void burst(INITIAL_BURST);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void burst(WAKE_BURST);
      else schedule();
    });
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      rescheduleRef.current = null;
      subscription.remove();
    };
  }, [ping]);

  const serverNow = useCallback(
    () => (estimate === null ? null : clientNow() + estimate.offsetMs),
    [estimate],
  );

  return { estimate, serverNow };
}
