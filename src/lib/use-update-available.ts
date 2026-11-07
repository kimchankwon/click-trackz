import { useUpdates } from "expo-updates";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { newerVersionIsLive } from "./app-version";

const CHECK_EVERY_MS = 5 * 60_000;

export function useUpdateAvailable() {
  const { isUpdatePending } = useUpdates();
  const [fetched, setFetched] = useState(false);
  const available = isUpdatePending || fetched;

  useEffect(() => {
    if (available) return;
    let cancelled = false;
    const check = () =>
      void newerVersionIsLive().then((newer) => {
        if (!cancelled && newer) setFetched(true);
      });
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [available]);

  return available;
}
