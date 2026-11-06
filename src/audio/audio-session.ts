import { AudioManager } from "react-native-audio-api";

import { describeAudioError } from "./audio-failure";

export function preferPlaybackSession() {
  AudioManager.setAudioSessionOptions({ iosCategory: "playback", iosMode: "default", iosOptions: ["mixWithOthers"] });
}

export async function probeAudioSession(): Promise<string | null> {
  try {
    await AudioManager.setAudioSessionActivity(true);
    return null;
  } catch (error) {
    return describeAudioError(error);
  }
}
