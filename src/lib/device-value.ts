import { useSyncExternalStore } from "react";

import { clearDeviceValue, readDeviceValue, writeDeviceValue } from "./device-store";

export function deviceValue<T>(name: string, parse: (json: string | null) => T | null) {
  let stored: T | null | undefined;
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  const publish = (next: T | null) => {
    stored = next;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (stored === undefined && loading === null) {
      loading = readDeviceValue(name)
        .then((json) => publish(stored === undefined ? parse(json) : (stored ?? null)))
        .catch(() => publish(stored ?? null));
    }
    return () => listeners.delete(listener);
  };

  const current = () => stored;

  return {
    useValue: (): T | null | undefined => useSyncExternalStore(subscribe, current, current),
    save: (value: T) => {
      publish(value);
      return writeDeviceValue(name, JSON.stringify(value)).catch(() => undefined);
    },
    forget: async () => {
      publish(null);
      await clearDeviceValue(name).catch(() => undefined);
    },
  };
}
