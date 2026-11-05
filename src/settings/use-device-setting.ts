import { useCallback, useEffect, useState } from "react";

import { deviceStore } from "./device-store";

export function useDeviceSetting<T extends string>(key: string, fallback: T, isValid: (value: string) => value is T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    let cancelled = false;
    void deviceStore.get(key).then((stored) => {
      if (!cancelled && stored !== null && isValid(stored)) setValue(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [key, isValid]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      void deviceStore.set(key, next);
    },
    [key],
  );

  return [value, update] as const;
}
