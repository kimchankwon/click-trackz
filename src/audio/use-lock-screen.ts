import { useEffect, useEffectEvent, useRef } from "react";

import { LOCK_SCREEN_COMMANDS, type LockScreenCommand, type LockScreenInfo } from "@/lib/lock-screen";

import { setOwnsNowPlaying } from "./audio-session";
import { clearLockScreen, onLockScreenCommand, setLockScreenControls, showOnLockScreen } from "./now-playing";

const REFRESH_MS = 1_000;

const ignore = () => undefined;

export type LockScreenReading = { info: LockScreenInfo; controls: Record<LockScreenCommand, boolean> };

const infoKeyOf = ({ title, artist, album, duration, speed }: LockScreenInfo) => [title, artist, album, duration, speed].join("|");

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
  const shown = useRef<{ info: string; controls: string } | null>(null);

  const refresh = useEffectEvent(() => {
    const reading = readNow();
    const infoKey = infoKeyOf(reading.info);
    const controlsKey = controlsKeyOf(reading.controls);
    const last = shown.current;
    if (last?.info !== infoKey) showOnLockScreen(reading.info).catch(ignore);
    if (last?.controls !== controlsKey) setLockScreenControls(reading.controls).catch(ignore);
    shown.current = { info: infoKey, controls: controlsKey };
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
      shown.current = null;
      clearLockScreen().catch(ignore);
    };
  }, [on]);

  useEffect(() => {
    if (on) refresh();
  }, [on, refreshKey]);
}
