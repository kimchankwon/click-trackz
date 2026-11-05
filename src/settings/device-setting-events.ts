type Listener = (value: string) => void;

const listeners = new Map<string, Set<Listener>>();

export function notifyDeviceSetting(key: string, value: string) {
  listeners.get(key)?.forEach((listener) => listener(value));
}

export function onDeviceSetting(key: string, listener: Listener) {
  const forKey = listeners.get(key) ?? new Set<Listener>();
  forKey.add(listener);
  listeners.set(key, forKey);
  return () => {
    forKey.delete(listener);
  };
}
