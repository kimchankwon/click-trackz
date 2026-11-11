import { describe, expect, it } from "vitest";

import type { Id } from "../../convex/_generated/dataModel";
import { librarySetlist, librarySetlists, librarySong, librarySongs, parseSnapshot, type LibrarySnapshot } from "./snapshot";

const verse = { sectionType: "Verse", bars: 8, beatsPerBar: 3, bpm: 96 };

const snapshot: LibrarySnapshot = {
  groupId: "g1" as Id<"groups">,
  revision: 3,
  name: "My Library",
  currentSetlistId: "l1" as Id<"setlists">,
  savedAt: 5,
  songs: [
    { songId: "s1" as Id<"songs">, title: "Etude", key: "G", tempoHint: null, bpm: null, countIn: true, subdivision: 1, cueLeadBars: 2, copyBase: null, sections: [verse] },
    { songId: "s2" as Id<"songs">, title: "Sketch", key: null, tempoHint: null, bpm: null, countIn: false, subdivision: 1, cueLeadBars: 2, copyBase: null, sections: [] },
  ],
  setlists: [
    {
      setlistId: "l1" as Id<"setlists">,
      name: "Practice",
      revision: 2,
      entries: [
        { songId: "s2" as Id<"songs">, key: null, leader: null },
        { songId: "gone" as Id<"songs">, key: null, leader: null },
        { songId: "s1" as Id<"songs">, key: "A", leader: "Me" },
      ],
    },
  ],
};

describe("My Library snapshot", () => {
  it("summarises its Songs the way the Song library does", () => {
    expect(librarySongs(snapshot)).toEqual([
      { songId: "s1", title: "Etude", key: "G", countIn: true, sectionCount: 1, timeSignature: "3/4", bpm: 96 },
      { songId: "s2", title: "Sketch", key: null, countIn: false, sectionCount: 0, timeSignature: null, bpm: null },
    ]);
    expect(librarySong(snapshot, "s1" as Id<"songs">)?.title).toBe("Etude");
    expect(librarySong(snapshot, "nope" as Id<"songs">)).toBeNull();
  });

  it("lists Setlists with the current one marked, and drops entries whose Song is gone", () => {
    expect(librarySetlists(snapshot)).toEqual([{ setlistId: "l1", name: "Practice", songCount: 3, isCurrent: true }]);
    expect(librarySetlist(snapshot, "l1" as Id<"setlists">)).toEqual({
      setlistId: "l1",
      name: "Practice",
      revision: 2,
      entries: [
        { songId: "s2", title: "Sketch", key: null, leader: null, needsStructure: true },
        { songId: "s1", title: "Etude", key: "A", leader: "Me", needsStructure: false },
      ],
    });
  });

  it("reads back what was saved, and nothing from a damaged file", () => {
    expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(parseSnapshot("{oops")).toBeNull();
    expect(parseSnapshot(JSON.stringify({ groupId: "g1" }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ ...snapshot, revision: undefined }))).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });
});
