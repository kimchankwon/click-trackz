import type { LockScreenCommand, LockScreenInfo } from "@/lib/lock-screen";

export const lockScreenAvailable = false;

export function showOnLockScreen(_info: LockScreenInfo): Promise<void> {
  return Promise.resolve();
}

export function setLockScreenControls(_enabled: Record<LockScreenCommand, boolean>): Promise<void> {
  return Promise.resolve();
}

export function clearLockScreen(): Promise<void> {
  return Promise.resolve();
}

export function onLockScreenCommand(_handler: (command: LockScreenCommand) => void): () => void {
  return () => undefined;
}
