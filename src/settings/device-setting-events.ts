type Listener = (value: string) => void;

const listeners = new Map<string, Set<Listener>>();
const lastNotified = new Map<string, string>();

export function notifyDeviceSetting(key: string, value: string) {
  lastNotified.set(key, value);
  listeners.get(key)?.forEach((listener) => listener(value));
}

export function lastNotifiedSetting(key: string): string | undefined {
  return lastNotified.get(key);
}

export function onDeviceSetting(key: string, listener: Listener) {
  const forKey = listeners.get(key) ?? new Set<Listener>();
  forKey.add(listener);
  listeners.set(key, forKey);
  return () => {
    forKey.delete(listener);
  };
}
