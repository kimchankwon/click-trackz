import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";

import { api } from "../../convex/_generated/api";
import { estimateClockOffset, type ClockEstimate, type ClockSample } from "./clock";

const INITIAL_BURST = 8;
const RESAMPLE_EVERY_MS = 5_000;
const SAMPLE_WINDOW = 12;

const clientNow = () => performance.now();

export type ServerClock = {
  estimate: ClockEstimate | null;
  serverNow: () => number | null;
};

export function useServerClock(): ServerClock {
  const ping = useMutation(api.clock.now);
  const [estimate, setEstimate] = useState<ClockEstimate | null>(null);

  useEffect(() => {
    let cancelled = false;
    const samples: ClockSample[] = [];
    const sampleOnce = async () => {
      const sentAt = clientNow();
      const serverAt = await ping({});
      const receivedAt = clientNow();
      if (cancelled) return;
      samples.push({ sentAt, serverAt, receivedAt });
      if (samples.length > SAMPLE_WINDOW) samples.shift();
      setEstimate(estimateClockOffset(samples));
    };
    const burst = async () => {
      for (let i = 0; i < INITIAL_BURST && !cancelled; i++) await sampleOnce().catch(() => undefined);
    };
    void burst();
    const timer = setInterval(() => void sampleOnce().catch(() => undefined), RESAMPLE_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ping]);

  const serverNow = useCallback(
    () => (estimate === null ? null : clientNow() + estimate.offsetMs),
    [estimate],
  );

  return { estimate, serverNow };
}
