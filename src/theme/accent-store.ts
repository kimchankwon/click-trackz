import { useSyncExternalStore } from "react";

import { defaultAccent, isAccentId, type AccentId } from "./accents";

export const ACCENT_KEY = "accent";

function readInitial(): AccentId {
  try {
    const stored = typeof window !== "undefined" ? window.localStorage?.getItem(ACCENT_KEY) : null;
    return stored && isAccentId(stored) ? stored : defaultAccent;
  } catch {
    return defaultAccent;
  }
}

let current: AccentId = readInitial();
const listeners = new Set<() => void>();

export const getAccent = () => current;

export function setAccent(next: AccentId) {
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAccent(): AccentId {
  return useSyncExternalStore(subscribe, getAccent, getAccent);
}
