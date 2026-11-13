/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import { HANDOFF_MS } from "./guestHandoff";
import schema from "./schema";
import { demoSong } from "../src/sync/demo-song";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000;

async function setup() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", profile);
      if (profile.email !== undefined) await ctx.db.insert("subscriptions", { userId: id, plan: "pro", expiresAt: null, syncedAt: 0 });
      return id;
    });
    return { userId, client: t.withIdentity({ subject: `${userId}|session` }) };
  };
  const admin = await as({ email: "admin@example.com" });
  const band = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  const choir = await admin.client.mutation(api.groups.createGroup, { name: "Choir", displayName: "Admin" });
  const guest = await as({ isAnonymous: true });
  await guest.client.mutation(api.groups.joinGroup, { joinCode: band.joinCode, displayName: "Sam" });
  await guest.client.mutation(api.groups.joinGroup, { joinCode: choir.joinCode, displayName: "Sammy" });
  await admin.client.mutation(api.groups.setRole, { groupId: band.groupId, userId: guest.userId, role: "songManager" });
  const google = await as({ email: "sam@example.com" });
  const membersOf = async (groupId: typeof band.groupId) =>
    (await admin.client.query(api.groups.members, { groupId })).map((m) => ({ userId: m.userId, name: m.displayName, role: m.role }));
  return { t, admin, guest, google, band, choir, membersOf };
}

describe("Guest handoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("moves a guest's Group memberships, Role and name onto the Google account they sign in with", async () => {
    const { t, admin, guest, google, band, choir, membersOf } = await setup();
    const songId = await admin.client.mutation(api.songs.createSong, { groupId: band.groupId, title: "Pure" });
    await admin.client.mutation(api.songs.updateSong, { songId, sections: [...demoSong.sections] });
    await guest.client.mutation(api.playback.start, { groupId: band.groupId, songId });
    const token = await guest.client.mutation(api.guestHandoff.start, {});

    expect(await google.client.mutation(api.guestHandoff.claim, { token })).toBe(2);

    expect(await membersOf(band.groupId)).toEqual([
      { userId: admin.userId, name: "Admin", role: "admin" },
      { userId: google.userId, name: "Sam", role: "songManager" },
    ]);
    expect(await membersOf(choir.groupId)).toEqual([
      { userId: admin.userId, name: "Admin", role: "admin" },
      { userId: google.userId, name: "Sammy", role: "member" },
    ]);
    expect((await t.run((ctx) => ctx.db.query("playbacks").first()))?.startedBy).toBe(google.userId);
    expect(await t.run((ctx) => ctx.db.get(guest.userId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("guestHandoffs").collect())).toEqual([]);
  });

  it("overwrites the Google account's own record in a Group it is already in, keeping the higher Role", async () => {
    const { admin, guest, google, band, choir, membersOf } = await setup();
    await google.client.mutation(api.groups.joinGroup, { joinCode: band.joinCode, displayName: "Samuel" });
    await google.client.mutation(api.groups.joinGroup, { joinCode: choir.joinCode, displayName: "Samuel" });
    await admin.client.mutation(api.groups.setRole, { groupId: choir.groupId, userId: google.userId, role: "playbackManager" });
    const token = await guest.client.mutation(api.guestHandoff.start, {});

    await google.client.mutation(api.guestHandoff.claim, { token });

    expect(await membersOf(band.groupId)).toEqual([
      { userId: admin.userId, name: "Admin", role: "admin" },
      { userId: google.userId, name: "Sam", role: "songManager" },
    ]);
    expect(await membersOf(choir.groupId)).toEqual([
      { userId: admin.userId, name: "Admin", role: "admin" },
      { userId: google.userId, name: "Sammy", role: "playbackManager" },
    ]);
  });

  it("uses each handoff once, only within half an hour, and only from a guest to a Google account", async () => {
    const { guest, google, band, membersOf } = await setup();
    await expect(google.client.mutation(api.guestHandoff.start, {})).rejects.toThrow(/Only a guest/);
    const token = await guest.client.mutation(api.guestHandoff.start, {});
    await expect(guest.client.mutation(api.guestHandoff.claim, { token })).rejects.toThrow(/Sign in with Google first/);

    vi.setSystemTime(NOW + HANDOFF_MS + 1);
    expect(await google.client.mutation(api.guestHandoff.claim, { token })).toBe(0);
    expect(await google.client.mutation(api.guestHandoff.claim, { token: "made-up" })).toBe(0);
    expect((await membersOf(band.groupId)).map((m) => m.name)).toEqual(["Admin", "Sam"]);

    const fresh = await guest.client.mutation(api.guestHandoff.start, {});
    expect(await google.client.mutation(api.guestHandoff.claim, { token: fresh })).toBe(2);
    expect(await google.client.mutation(api.guestHandoff.claim, { token: fresh })).toBe(0);
  });

  it("leaves the guest's My Library with the guest", async () => {
    const { t, guest, google } = await setup();
    const libraryId = await guest.client.mutation(api.groups.openOffline, {});
    await guest.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Mine" });
    const token = await guest.client.mutation(api.guestHandoff.start, {});

    expect(await google.client.mutation(api.guestHandoff.claim, { token })).toBe(2);

    expect((await guest.client.query(api.groups.myGroups, {})).map((g) => g.name)).toEqual(["My Library"]);
    expect(await t.run((ctx) => ctx.db.get(guest.userId))).not.toBeNull();
  });
});
