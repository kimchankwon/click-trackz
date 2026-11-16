import type { HapticStrength } from "@/settings/output";

export const hapticsAvailable = typeof navigator !== "undefined" && typeof navigator.vibrate === "function" && navigator.maxTouchPoints > 0;

export function tapHaptic(strength: HapticStrength) {
  if (!hapticsAvailable) return;
  try {
    navigator.vibrate(strength === "strong" ? 45 : 20);
  } catch {
    return;
  }
}
