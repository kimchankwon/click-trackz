import { useSyncExternalStore } from "react";

let playingHere = false;
const listeners = new Set<() => void>();

export function setPlayingHere(playing: boolean) {
  if (playing === playingHere) return;
  playingHere = playing;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function usePlayingHere() {
  return useSyncExternalStore(subscribe, () => playingHere);
}
