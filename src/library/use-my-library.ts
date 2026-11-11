import { useConvex, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { clearStoredLibrary, readStoredLibrary, writeStoredLibrary } from "./library-store";
import { librarySetlist, librarySetlists, librarySong, librarySongs, parseSnapshot, type LibrarySnapshot } from "./snapshot";

let stored: LibrarySnapshot | null | undefined;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const publish = (next: LibrarySnapshot | null) => {
  stored = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (stored === undefined && loading === null) {
    loading = readStoredLibrary()
      .then((json) => publish(stored === undefined ? parseSnapshot(json) : (stored ?? null)))
      .catch(() => publish(stored ?? null));
  }
  return () => listeners.delete(listener);
};

const current = () => stored;

export function useStoredLibrary(): LibrarySnapshot | null | undefined {
  return useSyncExternalStore(subscribe, current, current);
}

export async function forgetStoredLibrary() {
  publish(null);
  await clearStoredLibrary().catch(() => undefined);
}

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
        const snapshot: LibrarySnapshot = { ...fresh, savedAt: Date.now() };
        publish(snapshot);
        void writeStoredLibrary(JSON.stringify(snapshot)).catch(() => undefined);
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
