import { Platform } from "react-native";
import { Asset } from "expo-asset";
import { PlaybackNotificationManager, type PlaybackControlName } from "react-native-audio-api";

import { LOCK_SCREEN_CONTROLS, type LockScreenCommand, type LockScreenControl, type LockScreenInfo } from "@/lib/lock-screen";

import { onHeadsetPlayPause, setHeadsetPlayPause } from "./headset-play-pause";
import { nowPlayingArtwork } from "./now-playing-artwork";

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

let artwork: Promise<string | null> | null = null;

const filePathOf = (uri: string) => (uri.startsWith("file://") ? decodeURIComponent(uri.slice("file://".length)) : uri);

function artworkPath(): Promise<string | null> {
  artwork ??= Asset.fromModule(nowPlayingArtwork)
    .downloadAsync()
    .then((asset) => filePathOf(asset.localUri ?? asset.uri))
    .catch(() => null);
  return artwork;
}

function inTurn(task: () => Promise<void>): Promise<void> {
  const turn = queue.then(task, task);
  queue = turn.catch(() => undefined);
  return turn;
}

const enabledNow = new Map<PlaybackControlName, boolean>();

async function setControl(control: PlaybackControlName, enabled: boolean) {
  if (enabledNow.get(control) === enabled) return;
  await PlaybackNotificationManager.enableControl(control, enabled);
  enabledNow.set(control, enabled);
}

export function showOnLockScreen(info: LockScreenInfo): Promise<void> {
  if (!lockScreenAvailable) return Promise.resolve();
  const queuedAt = performance.now();
  return inTurn(async () => {
    const path = await artworkPath();
    const waitedS = info.speed > 0 ? (performance.now() - queuedAt) / 1000 : 0;
    const elapsedTime = info.duration > 0 ? Math.min(info.duration, info.elapsedTime + waitedS) : info.elapsedTime + waitedS;
    await PlaybackNotificationManager.show({ ...info, elapsedTime, state: info.speed > 0 ? "playing" : "paused", ...(path === null ? {} : { artwork: path }) });
  });
}

export function setLockScreenControls(enabled: Record<LockScreenCommand, boolean>): Promise<void> {
  if (!lockScreenAvailable) return Promise.resolve();
  return inTurn(async () => {
    for (const control of UNUSED_CONTROLS) await setControl(control, false);
    for (const control of LOCK_SCREEN_CONTROLS) await setControl(control, enabled[control]);
    setHeadsetPlayPause(enabled.togglePlayPause);
  });
}

export function clearLockScreen(): Promise<void> {
  if (!lockScreenAvailable) return Promise.resolve();
  return inTurn(async () => {
    setHeadsetPlayPause(false);
    for (const control of [...UNUSED_CONTROLS, ...LOCK_SCREEN_CONTROLS]) await setControl(control, false);
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
