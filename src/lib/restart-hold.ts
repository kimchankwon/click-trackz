import { useEffect, useSyncExternalStore } from "react";

let holds = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function holdRestart() {
  holds += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    notify();
  };
}

export function restartHeld() {
  return holds > 0;
}

export function restartWhenFree(restart: () => void) {
  const timer = setTimeout(() => {
    if (!restartHeld()) restart();
  }, 0);
  return () => clearTimeout(timer);
}

export function useHoldRestart(hold: boolean) {
  useEffect(() => (hold ? holdRestart() : undefined), [hold]);
}

export function useRestartHeld() {
  return useSyncExternalStore(subscribe, restartHeld);
}
