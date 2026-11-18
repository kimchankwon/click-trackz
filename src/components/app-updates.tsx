import { useEffect } from "react";

import { reloadApp } from "@/lib/app-version";
import { restartWhenFree, useRestartHeld } from "@/lib/restart-hold";
import { useUpdateAvailable } from "@/lib/use-update-available";

export function AppUpdates() {
  const available = useUpdateAvailable();
  const held = useRestartHeld();

  useEffect(() => (available && !held ? restartWhenFree(reloadApp) : undefined), [available, held]);

  return null;
}
