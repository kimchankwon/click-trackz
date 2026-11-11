import type { Doc } from "../../convex/_generated/dataModel";
import { mainBpm, mainTimeSignature } from "../sync/song-summary";
import { cueLeadBarsOf, subdivisionOf } from "../sync/timeline";

export type StoredSong = Pick<Doc<"songs">, "_id" | "title" | "key" | "tempoHint" | "bpm" | "countIn" | "subdivision" | "cueLeadBars" | "copyBase" | "sections">;

export const songView = (song: StoredSong) => ({
  songId: song._id,
  title: song.title,
  key: song.key ?? null,
  tempoHint: song.tempoHint ?? null,
  bpm: song.bpm ?? null,
  countIn: song.countIn,
  subdivision: subdivisionOf(song),
  cueLeadBars: cueLeadBarsOf(song),
  copyBase: song.copyBase ?? null,
  sections: song.sections,
});

export type SongView = ReturnType<typeof songView>;

export const songSummary = (song: StoredSong) => ({
  songId: song._id,
  title: song.title,
  key: song.key ?? null,
  countIn: song.countIn,
  sectionCount: song.sections.length,
  timeSignature: mainTimeSignature(song.sections),
  bpm: mainBpm({ bpm: song.bpm, sections: song.sections }),
});

export type SongSummary = ReturnType<typeof songSummary>;

export const summaryOfView = (view: SongView): SongSummary =>
  songSummary({ ...view, _id: view.songId, key: view.key ?? undefined, tempoHint: view.tempoHint ?? undefined, bpm: view.bpm ?? undefined, copyBase: view.copyBase ?? undefined });
