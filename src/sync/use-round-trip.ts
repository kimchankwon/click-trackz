import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { api } from "../../convex/_generated/api";
import { bestOf, keepRecent, ROUND_TRIP_BURST, ROUND_TRIP_REFRESH_MS } from "./round-trip";

export function useRoundTrip(active: boolean): number | null {
  const ping = useMutation(api.clock.now);
  const { isAuthenticated } = useConvexAuth();
  const [roundTrips, setRoundTrips] = useState<readonly number[]>([]);

  useEffect(() => {
    if (!active || !isAuthenticated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pingOnce = async () => {
      const sentAt = performance.now();
      await ping({});
      if (!cancelled) setRoundTrips((recent) => keepRecent(recent, performance.now() - sentAt));
    };
    const stop = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const refresh = () => {
      stop();
      if (cancelled || AppState.currentState !== "active") return;
      timer = setTimeout(() => void pingOnce().catch(() => undefined).finally(refresh), ROUND_TRIP_REFRESH_MS);
    };
    const burst = async () => {
      stop();
      for (let i = 0; i < ROUND_TRIP_BURST && !cancelled; i++) await pingOnce().catch(() => undefined);
      refresh();
    };
    void burst();
    const subscription = AppState.addEventListener("change", (state) => (state === "active" ? void burst() : stop()));
    return () => {
      cancelled = true;
      stop();
      subscription.remove();
    };
  }, [active, isAuthenticated, ping]);

  return bestOf(roundTrips);
}
