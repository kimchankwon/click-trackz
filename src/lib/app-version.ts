import * as Updates from "expo-updates";

export async function newerVersionIsLive(): Promise<boolean> {
  if (!Updates.isEnabled) return false;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew;
  } catch {
    return false;
  }
}

export function reloadApp() {
  void (async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      return;
    }
  })();
}

export function canReloadForStaleApp(): boolean {
  return false;
}

export function reloadForStaleApp() {}
