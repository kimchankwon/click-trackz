import { Platform } from "react-native";
import { PlaybackNotificationManager, type PlaybackControlName } from "react-native-audio-api";

import { LOCK_SCREEN_CONTROLS, type LockScreenCommand, type LockScreenControl, type LockScreenInfo } from "@/lib/lock-screen";

import { onHeadsetPlayPause, setHeadsetPlayPause } from "./headset-play-pause";

export const lockScreenAvailable = Platform.OS === "ios";

const EVENT_OF = {
  play: "playbackNotificationPlay",
  pause: "playbackNotificationPause",
  stop: "playbackNotificationStop",
  nextTrack: "playbackNotificationNextTrack",
  previousTrack: "playbackNotificationPreviousTrack",
} as const satisfies Record<LockScreenControl, string>;

const UNUSED_CONTROLS: readonly PlaybackControlName[] = ["skipForward", "skipBackward", "seekTo"];

let queue: Promise<void> = Promise.resolve();

function inTurn(task: () => Promise<void>): Promise<void> {
  const turn = queue.then(task, task);
  queue = turn.catch(() => undefined);
  return turn;
}

export function showOnLockScreen(info: LockScreenInfo): Promise<void> {
  if (!lockScreenAvailable) return Promise.resolve();
  return inTurn(() => PlaybackNotificationManager.show({ ...info, state: info.speed > 0 ? "playing" : "paused" }));
}

export function setLockScreenControls(enabled: Record<LockScreenCommand, boolean>): Promise<void> {
  if (!lockScreenAvailable) return Promise.resolve();
  return inTurn(async () => {
    for (const control of UNUSED_CONTROLS) await PlaybackNotificationManager.enableControl(control, false);
    for (const control of LOCK_SCREEN_CONTROLS) await PlaybackNotificationManager.enableControl(control, enabled[control]);
    setHeadsetPlayPause(enabled.togglePlayPause);
  });
}

export function clearLockScreen(): Promise<void> {
  if (!lockScreenAvailable) return Promise.resolve();
  return inTurn(async () => {
    setHeadsetPlayPause(false);
    for (const control of [...UNUSED_CONTROLS, ...LOCK_SCREEN_CONTROLS]) await PlaybackNotificationManager.enableControl(control, false);
    await PlaybackNotificationManager.hide();
  });
}

export function onLockScreenCommand(handler: (command: LockScreenCommand) => void): () => void {
  if (!lockScreenAvailable) return () => undefined;
  const subscriptions = LOCK_SCREEN_CONTROLS.map((control) => PlaybackNotificationManager.addEventListener(EVENT_OF[control], () => handler(control)));
  const stopHeadset = onHeadsetPlayPause(() => handler("togglePlayPause"));
  return () => {
    for (const subscription of subscriptions) subscription.remove();
    stopHeadset();
  };
}
