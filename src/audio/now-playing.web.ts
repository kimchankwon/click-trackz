import type { LockScreenCommand, LockScreenInfo } from "@/lib/lock-screen";

export const lockScreenAvailable = false;

export async function showOnLockScreen(_info: LockScreenInfo): Promise<void> {}

export async function setLockScreenControls(_enabled: Record<LockScreenCommand, boolean>): Promise<void> {}

export async function clearLockScreen(): Promise<void> {}

export function onLockScreenCommand(_handler: (command: LockScreenCommand) => void): () => void {
  return () => undefined;
}
