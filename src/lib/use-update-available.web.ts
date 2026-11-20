import { useNewerVersionLive } from "./use-newer-version-live";

export function useUpdateAvailable() {
  return useNewerVersionLive({ skip: false, checkOnMount: false });
}
