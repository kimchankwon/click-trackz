import { AudioManager } from "react-native-audio-api";

export function preferPlaybackSession() {
  AudioManager.setAudioSessionOptions({ iosCategory: "playback", iosMode: "default", iosOptions: ["mixWithOthers", "allowBluetoothA2DP"] });
}
