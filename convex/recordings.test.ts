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
  const store = (bytes: number, type: string) =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
  return { t, admin, member, groupId, store };
}

describe("Voice pack recordings", () => {
  it("keeps one Admin-uploaded audio recording per word, under 1 MB, for every Member to play", async () => {
    const { t, admin, member, groupId, store } = await band();
    const first = await store(20_000, "audio/wav");
    await admin.mutation(api.recordings.save, { groupId, word: "Chorus", number: 2, storageId: first });
    const second = await store(30_000, "audio/mpeg");
    await admin.mutation(api.recordings.save, { groupId, word: "Chorus", number: 2, storageId: second });
    const recordings = await member.query(api.recordings.list, { groupId });
    expect(recordings).toEqual([expect.objectContaining({ key: "chorus-2", word: "Chorus", number: 2 })]);
    expect(recordings[0].url).toEqual(expect.any(String));
    expect(await t.run((ctx) => ctx.storage.getUrl(first))).toBeNull();

    const tooBig = await store(2_000_000, "audio/wav");
    expect(await admin.mutation(api.recordings.save, { groupId, word: "Verse", storageId: tooBig })).toEqual({ ok: false, error: expect.stringMatching(/1 MB/) });
    expect(await t.run((ctx) => ctx.storage.getUrl(tooBig))).toBeNull();
    const picture = await store(2_000, "image/png");
    expect(await admin.mutation(api.recordings.save, { groupId, word: "Verse", storageId: picture })).toEqual({ ok: false, error: expect.stringMatching(/audio/) });
    expect(await t.run((ctx) => ctx.storage.getUrl(picture))).toBeNull();
    await expect(member.mutation(api.recordings.save, { groupId, word: "Verse", storageId: await store(2_000, "audio/wav") })).rejects.toThrow(/Only Admins/);
    await expect(member.mutation(api.recordings.generateUploadUrl, { groupId })).rejects.toThrow(/Only Admins/);
  });

  it("adds a new word to this Group's Cue vocabulary so Songs can use it as a Section type", async () => {
    const { admin, member, groupId, store } = await band();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    const exhortation = { sectionType: "Exhortation", bars: 4, beatsPerBar: 4, bpm: 72 };
    await expect(admin.mutation(api.songs.updateSong, { songId, sections: [exhortation] })).rejects.toThrow(/Cue vocabulary/);
    await admin.mutation(api.recordings.save, { groupId, word: "Exhortation", storageId: await store(10_000, "audio/wav") });
    expect(await member.query(api.recordings.vocabulary, { groupId })).toContain("Exhortation");
    await admin.mutation(api.songs.updateSong, { songId, sections: [exhortation] });
    expect((await admin.query(api.songs.get, { songId }))?.sections[0].sectionType).toBe("Exhortation");
  });
});
