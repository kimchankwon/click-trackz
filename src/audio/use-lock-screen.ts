import { useEffect, useEffectEvent, useRef } from "react";

import { infoKeyOf, LOCK_SCREEN_COMMANDS, needsReshow, type LockScreenCommand, type LockScreenInfo, type ShownInfo } from "@/lib/lock-screen";

import { setOwnsNowPlaying } from "./audio-session";
import { clearLockScreen, onLockScreenCommand, setLockScreenControls, showOnLockScreen } from "./now-playing";

const REFRESH_MS = 200;

const ignore = () => undefined;

export type LockScreenReading = { info: LockScreenInfo; controls: Record<LockScreenCommand, boolean> };

const controlsKeyOf = (controls: Record<LockScreenCommand, boolean>) => LOCK_SCREEN_COMMANDS.filter((command) => controls[command]).join(",");

export function useLockScreen({
  on,
  sessionBusy,
  refreshKey,
  read,
  onCommand,
}: {
  on: boolean;
  sessionBusy: boolean;
  refreshKey: string;
  read: () => LockScreenReading;
  onCommand: (command: LockScreenCommand) => void;
}) {
  const handleCommand = useEffectEvent(onCommand);
  const readNow = useEffectEvent(read);
  const shown = useRef<{ info: ShownInfo | null; controls: string | null }>({ info: null, controls: null });

  const refresh = useEffectEvent(() => {
    const reading = readNow();
    const atMs = performance.now();
    const controlsKey = controlsKeyOf(reading.controls);
    const controlsChanged = shown.current.controls !== controlsKey;
    if (controlsChanged) {
      setLockScreenControls(reading.controls).catch(ignore);
      shown.current.controls = controlsKey;
    }
    if (controlsChanged || needsReshow(shown.current.info, reading.info, atMs)) {
      showOnLockScreen(reading.info).catch(ignore);
      shown.current.info = { key: infoKeyOf(reading.info), elapsedTime: reading.info.elapsedTime, speed: reading.info.speed, atMs };
    }
  });

  useEffect(() => {
    if (!sessionBusy) setOwnsNowPlaying(on);
  }, [on, sessionBusy]);

  useEffect(() => () => setOwnsNowPlaying(false, { applyNow: false }), []);

  useEffect(() => {
    if (!on) return;
    const unsubscribe = onLockScreenCommand((command) => {
      handleCommand(command);
      refresh();
    });
    const timer = setInterval(() => refresh(), REFRESH_MS);
    return () => {
      clearInterval(timer);
      unsubscribe();
      shown.current = { info: null, controls: null };
      clearLockScreen().catch(ignore);
    };
  }, [on]);

  useEffect(() => {
    if (on) refresh();
  }, [on, refreshKey]);
}
