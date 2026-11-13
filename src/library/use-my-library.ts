import { useConvex, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useMemo } from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { deviceValue } from "@/lib/device-value";
import { librarySetlist, librarySetlists, librarySong, librarySongs, parseSnapshot, SNAPSHOT_FORMAT, type LibrarySnapshot } from "./snapshot";

const library = deviceValue("my-library", parseSnapshot);

export const useStoredLibrary = library.useValue;

export const forgetStoredLibrary = library.forget;

export function useKeepLibraryOnDevice(groupId: Id<"groups">, enabled: boolean) {
  const convex = useConvex();
  const liveRevision = useQuery(api.library.revision, enabled ? { groupId } : "skip");
  const saved = useStoredLibrary();
  const readFromDisk = saved !== undefined;
  const savedRevision = saved && saved.groupId === groupId ? saved.revision : null;

  useEffect(() => {
    if (!enabled || !readFromDisk || liveRevision === undefined || liveRevision === null || liveRevision === savedRevision) return;
    let cancelled = false;
    convex.query(api.library.snapshot, { groupId }).then(
      (fresh) => {
        if (cancelled) return;
        const snapshot: LibrarySnapshot = { ...fresh, savedAt: Date.now(), format: SNAPSHOT_FORMAT };
        library.save(snapshot);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [convex, groupId, enabled, readFromDisk, liveRevision, savedRevision]);
}

export const liveOr = <T,>(live: T | undefined, saved: () => T | undefined): T | undefined => (live !== undefined ? live : saved());

export const StoredLibraryContext = createContext<LibrarySnapshot | null>(null);

export function useStoredLibraryFor(groupId: Id<"groups">) {
  const snapshot = useContext(StoredLibraryContext);
  const forGroup = snapshot !== null && snapshot.groupId === groupId ? snapshot : null;
  return useMemo(
    () =>
      forGroup === null
        ? null
        : {
            songs: librarySongs(forGroup),
            song: (songId: Id<"songs">) => librarySong(forGroup, songId),
            setlists: librarySetlists(forGroup),
            setlist: (setlistId: Id<"setlists">) => librarySetlist(forGroup, setlistId),
            currentSetlistId: forGroup.currentSetlistId,
          },
    [forGroup],
  );
}
