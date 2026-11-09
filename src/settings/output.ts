import type { Beat } from "@/sync/timeline";

export const SIDES = ["left", "both", "right"] as const;

export type Side = (typeof SIDES)[number];

export const isSide = (value: string): value is Side => SIDES.some((side) => side === value);

export const panOf = (side: Side) => (side === "left" ? -1 : side === "right" ? 1 : 0);

export const sideLabels: Record<Side, string> = { left: "Left", both: "Both", right: "Right" };

export const HAPTIC_BEATS = ["off", "downbeat", "every"] as const;

export type HapticBeat = (typeof HAPTIC_BEATS)[number];

export const isHapticBeat = (value: string): value is HapticBeat => HAPTIC_BEATS.some((setting) => setting === value);

export const hapticBeatLabels: Record<HapticBeat, string> = { off: "Off", downbeat: "Downbeats", every: "Every beat" };

export const LOCK_SCREEN_SETTINGS = ["off", "on"] as const;

export type LockScreenSetting = (typeof LOCK_SCREEN_SETTINGS)[number];

export const isLockScreenSetting = (value: string): value is LockScreenSetting => LOCK_SCREEN_SETTINGS.some((setting) => setting === value);

export type HapticStrength = "strong" | "light";

export function hapticFor(setting: HapticBeat, beat: Pick<Beat, "accent">): HapticStrength | null {
  if (setting === "off") return null;
  if (beat.accent) return "strong";
  return setting === "every" ? "light" : null;
}
