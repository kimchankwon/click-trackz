import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { api } from "../../convex/_generated/api";
import { clockSlept, estimateClockOffset, type ClockEstimate, type ClockSample } from "./clock";
import { holdsClockSteady, pingDelayMs } from "./ping-schedule";

const INITIAL_BURST = 8;
const WAKE_BURST = 4;
const SAMPLE_WINDOW = 12;
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

export function useServerClock({ playing = false, onDevice = false }: { playing?: boolean; onDevice?: boolean } = {}): ServerClock {
  const ping = useMutation(api.clock.now);
  const [estimate, setEstimate] = useState<ClockEstimate | null>(null);
  const playingRef = useRef(playing);
  const rescheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    playingRef.current = playing;
    rescheduleRef.current?.();
  }, [playing]);

  useEffect(() => {
    if (onDevice) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const openedAt = clientNow();
    const samples: ClockSample[] = [];
    let hasEstimate = false;
    let epochAtLastSample = epochNow();
    const steady = () => holdsClockSteady({ playing: playingRef.current, hasEstimate });
    const sampleOnce = async () => {
      if (steady()) return;
      const sentAt = clientNow();
      const epochAtSend = epochNow();
      const serverAt = await ping({});
      const receivedAt = clientNow();
      if (cancelled || steady() || clockSlept(epochAtSend, epochNow())) return;
      samples.push({ sentAt, serverAt, receivedAt });
      epochAtLastSample = epochNow();
      if (samples.length > SAMPLE_WINDOW) samples.shift();
      if (samples.length >= SAMPLES_BEFORE_READY) {
        hasEstimate = true;
        setEstimate(estimateClockOffset(samples));
      }
    };
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (cancelled) return;
      const delay = pingDelayMs({ sinceOpenMs: clientNow() - openedAt, playing: playingRef.current, hidden: isHidden(), hasEstimate });
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
    const forgetStaleSamples = () => {
      if (!clockSlept(epochAtLastSample, epochNow())) return;
      samples.length = 0;
      hasEstimate = false;
      epochAtLastSample = epochNow();
      setEstimate(null);
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
      rescheduleRef.current = null;
      subscription.remove();
    };
  }, [ping, onDevice]);

  const serverNow = useCallback(
    () => (onDevice ? deviceNow() : estimate === null ? null : clientNow() + estimate.offsetMs),
    [estimate, onDevice],
  );

  return { estimate: onDevice ? null : estimate, serverNow };
}
