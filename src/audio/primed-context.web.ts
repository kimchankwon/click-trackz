import { AudioContext } from "react-native-audio-api";

import { preferPlaybackSession } from "./audio-session";

const UNUSED_CLOSE_MS = 10_000;

let primed: AudioContext | null = null;

export function primeAudio() {
  try {
    preferPlaybackSession();
    if (primed !== null && primed.state !== "closed") {
      void primed.resume();
      return;
    }
    const context = new AudioContext();
    primed = context;
    void context.resume();
    setTimeout(() => {
      if (primed !== context) return;
      primed = null;
      void context.close();
    }, UNUSED_CLOSE_MS);
  } catch {
    primed = null;
  }
}

export function takePrimedContext(): AudioContext | null {
  const context = primed;
  primed = null;
  return context !== null && context.state !== "closed" ? context : null;
}
