import { describe, expect, it } from "vitest";

import { pickedSongFor, rememberPickedSong } from "./picked-song";

describe("picked Song", () => {
  it("has nothing for a Group until a Song is picked", () => {
    expect(pickedSongFor("group-unseen")).toBeNull();
  });

  it("keeps the latest pick for each Group separately", () => {
    rememberPickedSong("group-a", { songId: "song-1", fromSetlist: false, orderAt: null, followedStart: 100 });
    rememberPickedSong("group-b", { songId: "song-2", fromSetlist: true, orderAt: 3, followedStart: null });
    rememberPickedSong("group-a", { songId: "song-3", fromSetlist: true, orderAt: 1, followedStart: 100 });
    expect(pickedSongFor("group-a")).toEqual({ songId: "song-3", fromSetlist: true, orderAt: 1, followedStart: 100 });
    expect(pickedSongFor("group-b")).toEqual({ songId: "song-2", fromSetlist: true, orderAt: 3, followedStart: null });
  });
});
