import { useEffect, useState } from "react";

import { canReloadForStaleApp, reloadForStaleApp } from "./app-version";
import { isStaleAppError } from "./stale-app";

export function useStaleAppRecovery(error: unknown): boolean {
  const [canReload] = useState(canReloadForStaleApp);
  const updating = canReload && isStaleAppError(error);

  useEffect(() => {
    if (updating) reloadForStaleApp();
  }, [updating]);

  return updating;
}
