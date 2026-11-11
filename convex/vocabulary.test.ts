/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";
import { builtinSectionTypes } from "../src/sync/cue-vocabulary";

const modules = import.meta.glob("./**/*.ts");

async function setupGroup() {
  const t = convexTest(schema, modules);
  const adminId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { email: "admin@example.com" });
      if (true) await ctx.db.insert("subscriptions", { userId: id, plan: "pro", expiresAt: null, syncedAt: 0 });
      return id;
    });
  const admin = t.withIdentity({ subject: `${adminId}|session` });
  const { groupId } = await admin.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  return { t, admin, groupId };
}

describe("Cue vocabulary", () => {
  it("offers the built-in Section types", async () => {
    const { admin, groupId } = await setupGroup();
    expect(await admin.query(api.vocabulary.list, { groupId })).toEqual([...builtinSectionTypes]);
  });

  it("refuses a Section type outside the vocabulary", async () => {
    const { admin, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    const exhortation = { sectionType: "Exhortation", bars: 4, beatsPerBar: 4, bpm: 72 };
    await expect(admin.mutation(api.songs.updateSong, { songId, sections: [exhortation] })).rejects.toThrow(/Cue vocabulary/);
  });

  it("keeps a word an existing Song already uses so that Song can still be saved", async () => {
    const { t, admin, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    const exhortation = { sectionType: "Exhortation", bars: 4, beatsPerBar: 4, bpm: 72 };
    await t.run((ctx) => ctx.db.patch(songId, { sections: [exhortation] }));
    expect(await admin.query(api.vocabulary.list, { groupId })).toContain("Exhortation");
    await admin.mutation(api.songs.updateSong, { songId, title: "Pure (live)", sections: [exhortation] });
  });

  it("matches a word however it is typed and stores the vocabulary's spelling", async () => {
    const { t, admin, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    await admin.mutation(api.songs.updateSong, { songId, sections: [{ sectionType: "pre chorus", bars: 4, beatsPerBar: 4, bpm: 72 }] });
    expect((await t.run((ctx) => ctx.db.get(songId)))!.sections[0].sectionType).toBe("Pre-Chorus");
    await t.run((ctx) => ctx.db.patch(songId, { sections: [{ sectionType: "Refrain", bars: 4, beatsPerBar: 4, bpm: 72 }] }));
    await admin.mutation(api.songs.updateSong, { songId, sections: [{ sectionType: "refrain", bars: 2, beatsPerBar: 4, bpm: 72 }] });
    expect((await t.run((ctx) => ctx.db.get(songId)))!.sections[0]).toMatchObject({ sectionType: "Refrain", bars: 2 });
  });

  it("is only for Members", async () => {
    const { t, groupId } = await setupGroup();
    const strangerId = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const stranger = t.withIdentity({ subject: `${strangerId}|session` });
    await expect(stranger.query(api.vocabulary.list, { groupId })).rejects.toThrow(/not in this Group/);
  });
});
