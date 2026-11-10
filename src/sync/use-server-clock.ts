import { useConvexAuth, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { api } from "../../convex/_generated/api";
import { clockSlept, estimateClockOffset, SAMPLE_WINDOW, type ClockEstimate, type ClockSample } from "./clock";
import { pingDelayMs } from "./ping-schedule";

const INITIAL_BURST = 8;
const WAKE_BURST = 4;
const SAMPLES_BEFORE_READY = 4;

const clientNow = () => performance.now();
const epochNow = () => Date.now() - clientNow();
const deviceEpoch = epochNow();
export const deviceNow = () => deviceEpoch + clientNow();
const isHidden = () => AppState.currentState !== "active";

export type ServerClock = {
  estimate: ClockEstimate | null;
  serverNow: () => number | null;
};

export function useServerClock({ onDevice = false }: { onDevice?: boolean } = {}): ServerClock {
  const ping = useMutation(api.clock.now);
  const { isAuthenticated } = useConvexAuth();
  const [estimate, setEstimate] = useState<ClockEstimate | null>(null);
  const offsetMs = useRef<number | null>(null);

  useEffect(() => {
    if (onDevice || !isAuthenticated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const openedAt = clientNow();
    const samples: ClockSample[] = [];
    let hasEstimate = false;
    let epochAtLastSample = epochNow();
    const show = (next: ClockEstimate | null) => {
      offsetMs.current = next?.offsetMs ?? null;
      setEstimate(next);
    };
    const sampleOnce = async () => {
      const sentAt = clientNow();
      const epochAtSend = epochNow();
      const serverAt = await ping({});
      const receivedAt = clientNow();
      if (cancelled || clockSlept(epochAtSend, epochNow())) return;
      samples.push({ sentAt, serverAt, receivedAt });
      epochAtLastSample = epochNow();
      if (samples.length > SAMPLE_WINDOW) samples.shift();
      if (samples.length >= SAMPLES_BEFORE_READY) {
        hasEstimate = true;
        show(estimateClockOffset(samples));
      }
    };
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (cancelled) return;
      const delay = pingDelayMs({ sinceOpenMs: clientNow() - openedAt, hidden: isHidden(), hasEstimate });
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
    void burst(INITIAL_BURST);
    const forgetStaleSamples = () => {
      if (!clockSlept(epochAtLastSample, epochNow())) return;
      samples.length = 0;
      hasEstimate = false;
      epochAtLastSample = epochNow();
      show(null);
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        forgetStaleSamples();
        void burst(WAKE_BURST);
      } else schedule();
    });
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      subscription.remove();
    };
  }, [ping, onDevice, isAuthenticated]);

  const measured = estimate !== null;
  const serverNow = useCallback(() => {
    if (onDevice) return deviceNow();
    return measured && offsetMs.current !== null ? clientNow() + offsetMs.current : null;
  }, [measured, onDevice]);

  return { estimate: onDevice ? null : estimate, serverNow };
}
