import { useUpdates } from "expo-updates";

import { useNewerVersionLive } from "./use-newer-version-live";

export function useUpdateAvailable() {
  const { isUpdatePending } = useUpdates();
  return useNewerVersionLive({ skip: isUpdatePending, checkOnMount: true }) || isUpdatePending;
}
