import { useEffect } from "react";

import { reloadApp } from "@/lib/app-version";
import { useRestartHeld } from "@/lib/restart-hold";
import { useUpdateAvailable } from "@/lib/use-update-available";

export function AppUpdates() {
  const available = useUpdateAvailable();
  const held = useRestartHeld();

  useEffect(() => {
    if (available && !held) reloadApp();
  }, [available, held]);

  return null;
}
