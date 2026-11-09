import * as Haptics from "expo-haptics";

import type { HapticStrength } from "@/settings/output";

export const hapticsAvailable = true;

export function tapHaptic(strength: HapticStrength) {
  void Haptics.impactAsync(strength === "strong" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
