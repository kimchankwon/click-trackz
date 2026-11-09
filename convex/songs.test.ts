/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupGroup() {
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
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "So Will I", key: "D" });
    expect(await member.query(api.songs.list, { groupId })).toEqual([
      expect.objectContaining({ songId, title: "So Will I", key: "D", sectionCount: 0, countIn: true }),
    ]);
    await expect(member.mutation(api.songs.createSong, { groupId, title: "x" })).rejects.toThrow(/Only Admins/);
  });

  it("lists each Song's main time signature and tempo for the Song library", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Waltz", key: "G" });
    await admin.mutation(api.songs.updateSong, {
      songId,
      bpm: 96,
      sections: [
        { sectionType: "Intro", bars: 2, beatsPerBar: 4, bpm: 96 },
        { sectionType: "Verse", bars: 16, beatsPerBar: 3, bpm: 96 },
      ],
    });
    expect(await member.query(api.songs.list, { groupId })).toEqual([expect.objectContaining({ key: "G", timeSignature: "3/4", bpm: 96, sectionCount: 2 })]);
  });

  it("saves an Admin's Sections only when every Section is playable", async () => {
    const { admin, member, groupId } = await setupGroup();
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
    await expect(bad({ beatUnit: 3 })).rejects.toThrow(/time signature/);
    await expect(member.mutation(api.songs.updateSong, { songId, sections: [verse] })).rejects.toThrow(/Only Admins/);
  });

  it("saves how many times in a row each Section plays, from 1 to 16", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Again" });
    await admin.mutation(api.songs.updateSong, { songId, sections: [{ ...verse, plays: 3 }, { ...verse, number: 2, plays: 1 }] });
    const saved = await member.query(api.songs.get, { songId });
    expect(saved?.sections[0]).toMatchObject({ plays: 3 });
    expect(saved?.sections[1]).not.toHaveProperty("plays");

    const bad = (plays: number) => admin.mutation(api.songs.updateSong, { songId, sections: [{ ...verse, plays }] });
    await expect(bad(0)).rejects.toThrow(/Plays/);
    await expect(bad(17)).rejects.toThrow(/Plays/);
    await expect(bad(2.5)).rejects.toThrow(/Plays/);
  });

  it("saves a Section's time changes in bar order, and refuses ones that do not fit", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Odd" });
    const twoFour = { bar: 8, bars: 1, beatsPerBar: 2, beatUnit: 4 };
    const threeEight = { bar: 1, bars: 1, beatsPerBar: 3, beatUnit: 8 };
    await admin.mutation(api.songs.updateSong, { songId, sections: [{ ...verse, timeChanges: [twoFour, threeEight] }, { ...verse, number: 2, timeChanges: [] }] });
    const saved = await member.query(api.songs.get, { songId });
    expect(saved?.sections[0].timeChanges).toEqual([threeEight, twoFour]);
    expect(saved?.sections[1]).not.toHaveProperty("timeChanges");

    const bad = (timeChanges: (typeof twoFour)[]) => admin.mutation(api.songs.updateSong, { songId, sections: [{ ...verse, timeChanges }] });
    await expect(bad([{ ...twoFour, bar: 9 }])).rejects.toThrow(/Section 1: A time change must start/);
    await expect(bad([{ ...twoFour, bars: 2 }])).rejects.toThrow(/runs past the end/);
    await expect(bad([twoFour, { ...twoFour, bar: 7, bars: 2 }])).rejects.toThrow(/overlaps/);
    await expect(bad([{ ...twoFour, beatUnit: 5 }])).rejects.toThrow(/halves, quarters/);
  });

  it("saves the Song's Clicks per beat, from 1 to 4", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Waltz" });
    expect(await member.query(api.songs.get, { songId })).toMatchObject({ subdivision: 1 });
    await admin.mutation(api.songs.updateSong, { songId, subdivision: 2 });
    expect(await member.query(api.songs.get, { songId })).toMatchObject({ subdivision: 2 });
    await expect(admin.mutation(api.songs.updateSong, { songId, subdivision: 5 })).rejects.toThrow(/Clicks per beat/);
    await expect(admin.mutation(api.songs.updateSong, { songId, subdivision: 1.5 })).rejects.toThrow(/Clicks per beat/);
    await expect(member.mutation(api.songs.updateSong, { songId, subdivision: 3 })).rejects.toThrow(/Only Admins/);
  });

  it("saves whether the Song's cues start one or two bars before each Section", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Firm Foundation" });
    expect(await member.query(api.songs.get, { songId })).toMatchObject({ cueLeadBars: 2 });
    await admin.mutation(api.songs.updateSong, { songId, cueLeadBars: 1 });
    expect(await member.query(api.songs.get, { songId })).toMatchObject({ cueLeadBars: 1 });
    await expect(admin.mutation(api.songs.updateSong, { songId, cueLeadBars: 3 })).rejects.toThrow(/one or two bars/);
    await expect(member.mutation(api.songs.updateSong, { songId, cueLeadBars: 2 })).rejects.toThrow(/Only Admins/);
  });

  it("duplicates a Song under the next free number, with the same Key, tempo, cues and Sections", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Remembrance", key: "E" });
    await admin.mutation(api.songs.updateSong, { songId, bpm: 68, countIn: false, subdivision: 2, cueLeadBars: 1, sections: [verse] });
    const first = await admin.mutation(api.songs.duplicateSong, { songId });
    expect(first.title).toBe("Remembrance 2");
    const original = await member.query(api.songs.get, { songId });
    expect(await member.query(api.songs.get, { songId: first.songId })).toEqual({ ...original, songId: first.songId, title: "Remembrance 2", copyBase: "Remembrance" });
    expect((await admin.mutation(api.songs.duplicateSong, { songId })).title).toBe("Remembrance 3");
    expect((await admin.mutation(api.songs.duplicateSong, { songId: first.songId })).title).toBe("Remembrance 4");
    expect((await member.query(api.songs.list, { groupId })).map((song) => song.title)).toEqual([
      "Remembrance",
      "Remembrance 2",
      "Remembrance 3",
      "Remembrance 4",
    ]);
    await expect(member.mutation(api.songs.duplicateSong, { songId })).rejects.toThrow(/Only Admins/);
  });

  it("keeps a number that belongs to the title when copying it", async () => {
    const { admin, groupId } = await setupGroup();
    await admin.mutation(api.songs.createSong, { groupId, title: "Psalm" });
    const psalm23 = await admin.mutation(api.songs.createSong, { groupId, title: "Psalm 23" });
    expect((await admin.mutation(api.songs.duplicateSong, { songId: psalm23 })).title).toBe("Psalm 23 2");
  });

  it("plays every Section at the Song tempo unless it has its own tempo", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Send Me Out" });
    const bridge = { sectionType: "Bridge", bars: 8, beatsPerBar: 4, bpm: 70, ownTempo: true };
    await admin.mutation(api.songs.updateSong, { songId, bpm: 140, sections: [verse, bridge] });
    expect(await member.query(api.songs.get, { songId })).toMatchObject({ bpm: 140, sections: [{ ...verse, bpm: 140 }, bridge] });

    await admin.mutation(api.songs.updateSong, { songId, bpm: 144 });
    expect((await member.query(api.songs.get, { songId }))?.sections.map((s) => s.bpm)).toEqual([144, 70]);

    await expect(admin.mutation(api.songs.updateSong, { songId, bpm: 301 })).rejects.toThrow(/Song tempo/);
  });

  it("keeps an older Song's odd Sections on their own tempo when only the Song tempo changes", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "You Alone" });
    const slow = { sectionType: "Bridge", bars: 8, beatsPerBar: 4, bpm: 70 };
    await admin.mutation(api.songs.updateSong, { songId, sections: [verse, verse, slow] });
    await admin.mutation(api.songs.updateSong, { songId, bpm: 76 });
    expect((await member.query(api.songs.get, { songId }))?.sections.map((s) => [s.bpm, s.ownTempo])).toEqual([
      [76, false],
      [76, false],
      [70, true],
    ]);
  });

  it("keeps each Section's time signature, such as 6/8", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    const sixEight = { sectionType: "Verse", bars: 4, beatsPerBar: 6, beatUnit: 8, bpm: 150 };
    await admin.mutation(api.songs.updateSong, { songId, sections: [sixEight, verse] });
    expect((await member.query(api.songs.get, { songId }))?.sections).toEqual([sixEight, verse]);
  });

  it("ends the Group's Playback when the playing Song is deleted", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    await admin.mutation(api.songs.updateSong, { songId, sections: [verse] });
    await admin.mutation(api.playback.start, { groupId, songId });
    await admin.mutation(api.songs.deleteSong, { songId });
    expect(await member.query(api.playback.current, { groupId })).toBeNull();
  });
});
