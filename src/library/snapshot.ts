import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { summaryOfView, type SongSummary, type SongView } from "./song-views";

export type LibrarySnapshot = FunctionReturnType<typeof api.library.snapshot> & { savedAt: number };

export function parseSnapshot(json: string | null): LibrarySnapshot | null {
  if (json === null) return null;
  try {
    const value = JSON.parse(json) as Partial<LibrarySnapshot>;
    if (typeof value.groupId !== "string" || !Array.isArray(value.songs) || !Array.isArray(value.setlists) || typeof value.savedAt !== "number") return null;
    return value as LibrarySnapshot;
  } catch {
    return null;
  }
}

export const librarySongs = (snapshot: LibrarySnapshot): SongSummary[] => snapshot.songs.map(summaryOfView);

export const librarySong = (snapshot: LibrarySnapshot, songId: Id<"songs">): SongView | null => snapshot.songs.find((song) => song.songId === songId) ?? null;

export const librarySetlists = (snapshot: LibrarySnapshot) =>
  snapshot.setlists.map((setlist) => ({
    setlistId: setlist.setlistId,
    name: setlist.name,
    songCount: setlist.entries.length,
    isCurrent: snapshot.currentSetlistId === setlist.setlistId,
  }));

export function librarySetlist(snapshot: LibrarySnapshot, setlistId: Id<"setlists">) {
  const setlist = snapshot.setlists.find((candidate) => candidate.setlistId === setlistId);
  if (setlist === undefined) return null;
  const entries = setlist.entries.flatMap((entry) => {
    const song = librarySong(snapshot, entry.songId);
    return song === null ? [] : [{ songId: entry.songId, title: song.title, key: entry.key, leader: entry.leader, needsStructure: song.sections.length === 0 }];
  });
  return { setlistId, name: setlist.name, revision: setlist.revision, entries };
}
