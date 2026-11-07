import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { newerVersionIsLive } from "./app-version";

const CHECK_EVERY_MS = 5 * 60_000;

export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (available) return;
    let cancelled = false;
    const check = () =>
      void newerVersionIsLive().then((newer) => {
        if (!cancelled && newer) setAvailable(true);
      });
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
