import { Platform } from "react-native";
import { AudioManager } from "react-native-audio-api";

import { describeAudioError } from "./audio-failure";

let ownsNowPlaying = false;

export function preferPlaybackSession() {
  AudioManager.setAudioSessionOptions({ iosCategory: "playback", iosMode: "default", iosOptions: ownsNowPlaying ? [] : ["mixWithOthers"] });
}

export function setOwnsNowPlaying(owns: boolean, { applyNow = true }: { applyNow?: boolean } = {}) {
  if (owns === ownsNowPlaying) return;
  ownsNowPlaying = owns;
  if (applyNow) preferPlaybackSession();
}

export function onInterruptionEnded(handler: (shouldResume: boolean) => void): () => void {
  if (Platform.OS !== "ios") return () => undefined;
  AudioManager.observeAudioInterruptions(true);
  const subscription = AudioManager.addSystemEventListener("interruption", (event) => {
    if (event.type === "ended") handler(event.shouldResume);
  });
  return () => subscription.remove();
}

export async function probeAudioSession(): Promise<string | null> {
  try {
    await AudioManager.setAudioSessionActivity(true);
    return null;
  } catch (error) {
    return describeAudioError(error);
  }
}
