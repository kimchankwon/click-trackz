export const SIDES = ["left", "both", "right"] as const;

export type Side = (typeof SIDES)[number];

export const isSide = (value: string): value is Side => SIDES.some((side) => side === value);

export const panOf = (side: Side) => (side === "left" ? -1 : side === "right" ? 1 : 0);

export const sideLabels: Record<Side, string> = { left: "Left", both: "Both", right: "Right" };

export const LOCK_SCREEN_SETTINGS = ["off", "on"] as const;

export type LockScreenSetting = (typeof LOCK_SCREEN_SETTINGS)[number];

export const isLockScreenSetting = (value: string): value is LockScreenSetting => LOCK_SCREEN_SETTINGS.some((setting) => setting === value);

export const DEFAULT_LOCK_SCREEN_SETTING: LockScreenSetting = "on";

export const LOCK_SCREEN_SETTING_KEY = "lockScreen";
