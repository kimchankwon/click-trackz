import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { summaryOfView, type SongSummary, type SongView } from "./song-views";

export const SNAPSHOT_FORMAT = 1;

export type LibrarySnapshot = FunctionReturnType<typeof api.library.snapshot> & { savedAt: number; format: typeof SNAPSHOT_FORMAT };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isSong = (value: unknown) => isRecord(value) && typeof value.songId === "string" && typeof value.title === "string" && Array.isArray(value.sections);

const isSetlist = (value: unknown) =>
  isRecord(value) &&
  typeof value.setlistId === "string" &&
  typeof value.name === "string" &&
  Array.isArray(value.entries) &&
  value.entries.every((entry) => isRecord(entry) && typeof entry.songId === "string");

export function parseSnapshot(json: string | null): LibrarySnapshot | null {
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (
      !isRecord(value) ||
      value.format !== SNAPSHOT_FORMAT ||
      typeof value.groupId !== "string" ||
      typeof value.name !== "string" ||
      typeof value.revision !== "number" ||
      typeof value.savedAt !== "number" ||
      !Array.isArray(value.songs) ||
      !value.songs.every(isSong) ||
      !Array.isArray(value.setlists) ||
      !value.setlists.every(isSetlist)
    ) {
      return null;
    }
    return value as LibrarySnapshot;
  } catch {
    return null;
  }
}

export const storedLibraryGroup = (snapshot: LibrarySnapshot) => ({
  groupId: snapshot.groupId,
  name: snapshot.name,
  role: "admin" as const,
  offline: true,
  copyBase: null,
  guest: false,
  owned: true,
  joinCode: null,
});

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
