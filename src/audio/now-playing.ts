import { Platform } from "react-native";
import { PlaybackNotificationManager, type PlaybackControlName } from "react-native-audio-api";

import { LOCK_SCREEN_COMMANDS, type LockScreenCommand, type LockScreenInfo } from "@/lib/lock-screen";

export const lockScreenAvailable = Platform.OS === "ios";

const EVENT_OF = {
  play: "playbackNotificationPlay",
  pause: "playbackNotificationPause",
  stop: "playbackNotificationStop",
  nextTrack: "playbackNotificationNextTrack",
  previousTrack: "playbackNotificationPreviousTrack",
} as const satisfies Record<LockScreenCommand, string>;

const UNUSED_CONTROLS: readonly PlaybackControlName[] = ["skipForward", "skipBackward", "seekTo"];

export async function showOnLockScreen(info: LockScreenInfo): Promise<void> {
  if (!lockScreenAvailable) return;
  await PlaybackNotificationManager.show({ ...info, state: info.speed > 0 ? "playing" : "paused" });
}

export async function setLockScreenControls(enabled: Record<LockScreenCommand, boolean>): Promise<void> {
  if (!lockScreenAvailable) return;
  for (const control of UNUSED_CONTROLS) await PlaybackNotificationManager.enableControl(control, false);
  for (const command of LOCK_SCREEN_COMMANDS) await PlaybackNotificationManager.enableControl(command, enabled[command]);
}

export async function clearLockScreen(): Promise<void> {
  if (!lockScreenAvailable) return;
  for (const control of [...UNUSED_CONTROLS, ...LOCK_SCREEN_COMMANDS]) await PlaybackNotificationManager.enableControl(control, false);
  await PlaybackNotificationManager.hide();
}

export function onLockScreenCommand(handler: (command: LockScreenCommand) => void): () => void {
  if (!lockScreenAvailable) return () => undefined;
  const subscriptions = LOCK_SCREEN_COMMANDS.map((command) => PlaybackNotificationManager.addEventListener(EVENT_OF[command], () => handler(command)));
  return () => {
    for (const subscription of subscriptions) subscription.remove();
  };
}
