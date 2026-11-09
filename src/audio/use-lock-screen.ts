import { useEffect, useEffectEvent } from "react";

import { LOCK_SCREEN_COMMANDS, type LockScreenCommand, type LockScreenInfo } from "@/lib/lock-screen";

import { setOwnsNowPlaying } from "./audio-session";
import { clearLockScreen, onLockScreenCommand, setLockScreenControls, showOnLockScreen } from "./now-playing";

const ignore = () => undefined;

export function useLockScreen({
  on,
  infoKey,
  readInfo,
  controls,
  onCommand,
}: {
  on: boolean;
  infoKey: string;
  readInfo: () => LockScreenInfo;
  controls: Record<LockScreenCommand, boolean>;
  onCommand: (command: LockScreenCommand) => void;
}) {
  const handleCommand = useEffectEvent(onCommand);
  const currentInfo = useEffectEvent(readInfo);
  const controlsKey = LOCK_SCREEN_COMMANDS.filter((command) => controls[command]).join(",");

  useEffect(() => {
    if (!on) return;
    setOwnsNowPlaying(true);
    const unsubscribe = onLockScreenCommand((command) => handleCommand(command));
    return () => {
      unsubscribe();
      setOwnsNowPlaying(false);
      clearLockScreen().catch(ignore);
    };
  }, [on]);

  useEffect(() => {
    if (on) showOnLockScreen(currentInfo()).catch(ignore);
  }, [on, infoKey]);

  useEffect(() => {
    if (!on) return;
    const enabled = new Set(controlsKey.split(","));
    const next = Object.fromEntries(LOCK_SCREEN_COMMANDS.map((command) => [command, enabled.has(command)])) as Record<LockScreenCommand, boolean>;
    setLockScreenControls(next).catch(ignore);
  }, [on, controlsKey]);
}
