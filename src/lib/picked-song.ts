export type PickedSong<SongId extends string> = {
  songId: SongId | null;
  fromSetlist: boolean;
  orderAt: number | null;
  followedStart: number | null;
};

const picks = new Map<string, PickedSong<string>>();

export function pickedSongFor<SongId extends string>(groupId: string): PickedSong<SongId> | null {
  return (picks.get(groupId) as PickedSong<SongId> | undefined) ?? null;
}

export function rememberPickedSong<SongId extends string>(groupId: string, pick: PickedSong<SongId>) {
  picks.set(groupId, pick);
}
