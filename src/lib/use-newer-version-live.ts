import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { newerVersionIsLive } from "./app-version";

const CHECK_EVERY_MS = 5 * 60_000;

export function useNewerVersionLive({ skip, checkOnMount }: { skip: boolean; checkOnMount: boolean }) {
  const [newer, setNewer] = useState(false);

  useEffect(() => {
    if (skip || newer) return;
    let cancelled = false;
    const check = () =>
      void newerVersionIsLive().then((live) => {
        if (!cancelled && live) setNewer(true);
      });
    if (checkOnMount) check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [skip, newer, checkOnMount]);

  return newer;
}
