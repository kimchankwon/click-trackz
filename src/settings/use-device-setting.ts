import { useCallback, useEffect, useState } from "react";

import { onDeviceSetting } from "./device-setting-events";
import { deviceStore } from "./device-store";

export function useDeviceSetting<T extends string>(key: string, fallback: T, isValid: (value: string) => value is T) {
  const [value, setValue] = useState<T>(fallback);
  const [saveFailed, setSaveFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let changed = false;
    deviceStore.get(key).then(
      (stored) => {
        if (cancelled) return;
        if (!changed && stored !== null && isValid(stored)) setValue(stored);
        setLoaded(true);
      },
      () => {
        if (!cancelled) setLoaded(true);
      },
    );
    const unsubscribe = onDeviceSetting(key, (next) => {
      changed = true;
      setLoaded(true);
      if (isValid(next)) setValue(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [key, isValid]);

  const update = useCallback(
    (next: T) => {
      setSaveFailed(false);
      deviceStore.set(key, next).catch(() => setSaveFailed(true));
    },
    [key],
  );

  return [value, update, saveFailed, loaded] as const;
}
