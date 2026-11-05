// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function band() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", profile));
    return t.withIdentity({ subject: `${userId}|session` });
  };
  const admin = await as({ email: "admin@example.com" });
  const { groupId, joinCode } = await admin.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  const member = await as({ isAnonymous: true });
  await member.mutation(api.groups.joinGroup, { joinCode, displayName: "Member" });
  return { admin, member, groupId };
}

const verse = { sectionType: "Verse", number: 1, bars: 8, beatsPerBar: 4, bpm: 72 };

describe("Songs", () => {
  it("lets Admins add a Song that every Member can read, starting with no Sections", async () => {
    const { admin, member, groupId } = await band();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "So Will I", key: "D" });
    expect(await member.query(api.songs.list, { groupId })).toEqual([
      expect.objectContaining({ songId, title: "So Will I", key: "D", sectionCount: 0, countIn: true }),
    ]);
    await expect(member.mutation(api.songs.createSong, { groupId, title: "x" })).rejects.toThrow(/Only Admins/);
  });

  it("saves an Admin's Sections only when every Section is playable", async () => {
    const { admin, member, groupId } = await band();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    const intro = { sectionType: "Intro", bars: 4, beatsPerBar: 4, bpm: 72 };
    await admin.mutation(api.songs.updateSong, { songId, countIn: false, sections: [intro, verse] });
    expect(await member.query(api.songs.get, { songId })).toMatchObject({ title: "Pure", countIn: false, sections: [intro, verse] });

    const bad = (patch: object) => admin.mutation(api.songs.updateSong, { songId, sections: [{ ...verse, ...patch }] });
    await expect(bad({ bars: 0 })).rejects.toThrow(/Bars/);
    await expect(bad({ bars: 65 })).rejects.toThrow(/Bars/);
    await expect(bad({ beatsPerBar: 13 })).rejects.toThrow(/Beats per bar/);
    await expect(bad({ bpm: 29 })).rejects.toThrow(/BPM/);
    await expect(bad({ bpm: 301 })).rejects.toThrow(/BPM/);
    await expect(bad({ sectionType: "Spontaneous" })).rejects.toThrow(/Section type/);
    await expect(bad({ bars: 2.5 })).rejects.toThrow(/Bars/);
    await expect(member.mutation(api.songs.updateSong, { songId, sections: [verse] })).rejects.toThrow(/Only Admins/);
  });

  it("ends the Group's Playback when the playing Song is deleted", async () => {
    const { admin, member, groupId } = await band();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    await admin.mutation(api.songs.updateSong, { songId, sections: [verse] });
    await admin.mutation(api.playback.start, { groupId, songId });
    await admin.mutation(api.songs.deleteSong, { songId });
    expect(await member.query(api.playback.current, { groupId })).toBeNull();
  });
});
