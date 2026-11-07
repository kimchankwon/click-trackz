import { AudioContext } from "react-native-audio-api";

import { preferPlaybackSession } from "./audio-session";

const UNUSED_CLOSE_MS = 10_000;

let primed: AudioContext | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function closeIfUnused(context: AudioContext) {
  if (closeTimer !== null) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (primed !== context) return;
    primed = null;
    void context.close();
  }, UNUSED_CLOSE_MS);
}

export function primeAudio() {
  try {
    preferPlaybackSession();
    const context = primed !== null && primed.state !== "closed" ? primed : new AudioContext();
    primed = context;
    void context.resume();
    closeIfUnused(context);
  } catch {
    primed = null;
  }
}

export function takePrimedContext(): AudioContext | null {
  const context = primed;
  primed = null;
  return context !== null && context.state !== "closed" ? context : null;
}
