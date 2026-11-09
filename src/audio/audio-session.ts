import { AudioManager } from "react-native-audio-api";

import { describeAudioError } from "./audio-failure";

let ownsNowPlaying = false;

export function preferPlaybackSession() {
  AudioManager.setAudioSessionOptions({ iosCategory: "playback", iosMode: "default", iosOptions: ownsNowPlaying ? [] : ["mixWithOthers"] });
}

export function setOwnsNowPlaying(owns: boolean) {
  if (owns === ownsNowPlaying) return;
  ownsNowPlaying = owns;
  preferPlaybackSession();
}

export async function probeAudioSession(): Promise<string | null> {
  try {
    await AudioManager.setAudioSessionActivity(true);
    return null;
  } catch (error) {
    return describeAudioError(error);
  }
}
