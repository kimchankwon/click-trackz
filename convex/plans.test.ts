/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { compedPlan } from "./plans";
import schema from "./schema";
import { demoSong } from "../src/sync/demo-song";

const modules = import.meta.glob("./**/*.ts");

type Profile = { email?: string; isAnonymous?: boolean };

async function setup() {
  const t = convexTest(schema, modules);
  const as = async (profile: Profile, plan?: "plus" | "pro", expiresAt: number | null = null) => {
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", profile);
      if (plan) await ctx.db.insert("subscriptions", { userId: id, plan, expiresAt, syncedAt: 0 });
      return id;
    });
    return { userId, client: t.withIdentity({ subject: `${userId}|session` }) };
  };
  const setPlan = (userId: Id<"users">, plan: "plus" | "pro" | null) =>
    t.run(async (ctx) => {
      const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (existing) await ctx.db.delete(existing._id);
      if (plan) await ctx.db.insert("subscriptions", { userId, plan, expiresAt: null, syncedAt: 0 });
    });
  return { t, as, setPlan };
}

beforeEach(() => {
  vi.stubEnv("PLANS_ENFORCED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Before Plans are enforced", () => {
  it("lets anyone signed in create up to 5 Groups, never counting My Library, and never locks a Group", async () => {
    vi.stubEnv("PLANS_ENFORCED", "");
    const { as } = await setup();
    const free = await as({ email: "free@example.com" });
    await free.client.mutation(api.groups.openOffline, {});
    for (const name of ["One", "Two", "Three", "Four", "Five"]) await free.client.mutation(api.groups.createGroup, { name, displayName: "F" });
    await expect(free.client.mutation(api.groups.createGroup, { name: "Six", displayName: "F" })).rejects.toThrow(/up to 5 Groups for now/);
    const groupId = (await free.client.query(api.groups.myGroups, {})).find((group) => !group.offline)!.groupId;
    await expect(free.client.mutation(api.groups.duplicateGroup, { groupId })).rejects.toThrow(/up to 5 Groups for now/);
    expect((await free.client.query(api.groups.myGroups, {})).every((group) => !group.locked)).toBe(true);
    expect(await free.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "free", enforced: false, groups: 5 });
  });

  it("lets each Group hold up to 100 Songs, and leaves My Library unlimited", async () => {
    vi.stubEnv("PLANS_ENFORCED", "");
    const { t, as } = await setup();
    const free = await as({ email: "free@example.com" });
    const { groupId: full } = await free.client.mutation(api.groups.createGroup, { name: "Full", displayName: "F" });
    const { groupId: other } = await free.client.mutation(api.groups.createGroup, { name: "Other", displayName: "F" });
    const libraryId = await free.client.mutation(api.groups.openOffline, {});
    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++) await ctx.db.insert("songs", { groupId: full, title: `S${i}`, countIn: true, sections: [] });
      for (let i = 0; i < 100; i++) await ctx.db.insert("songs", { groupId: libraryId, title: `L${i}`, countIn: true, sections: [] });
    });
    await expect(free.client.mutation(api.songs.createSong, { groupId: full, title: "One more" })).rejects.toThrow(/up to 100 Songs for now/);
    const songId = await free.client.mutation(api.songs.createSong, { groupId: other, title: "Fits" });
    await expect(free.client.mutation(api.songs.copyToGroup, { songId, toGroupId: full })).rejects.toThrow(/up to 100 Songs for now/);
    await free.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Library has room" });
  });

  it("refuses to duplicate a Group that already holds more than 100 Songs", async () => {
    vi.stubEnv("PLANS_ENFORCED", "");
    const { t, as } = await setup();
    const free = await as({ email: "free@example.com" });
    const { groupId } = await free.client.mutation(api.groups.createGroup, { name: "Big", displayName: "F" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 101; i++) await ctx.db.insert("songs", { groupId, title: `S${i}`, countIn: true, sections: [] });
    });
    await expect(free.client.mutation(api.groups.duplicateGroup, { groupId })).rejects.toThrow(/up to 100 Songs for now, and this one has 101/);
    await t.run(async (ctx) => {
      const extra = await ctx.db.query("songs").withIndex("by_group", (q) => q.eq("groupId", groupId)).first();
      if (extra) await ctx.db.delete(extra._id);
    });
    await free.client.mutation(api.groups.duplicateGroup, { groupId });
    expect((await free.client.query(api.groups.myGroups, {})).filter((group) => !group.offline)).toHaveLength(2);
  });

  it("still shows a comped account as Plus", async () => {
    vi.stubEnv("PLANS_ENFORCED", "");
    vi.stubEnv("COMP_PLUS_EMAILS", "xtectra@example.com");
    const { as } = await setup();
    const daniel = await as({ email: "xtectra@example.com" });
    expect(await daniel.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "plus", enforced: false });
  });
});

describe("Creating Groups", () => {
  it("needs a subscription, though anyone can join a Group for free", async () => {
    const { as } = await setup();
    const free = await as({ email: "free@example.com" });
    await expect(free.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Free" })).rejects.toThrow(/Subscribe to Plus or Pro/);
    const plus = await as({ email: "plus@example.com" }, "plus");
    const { joinCode } = await plus.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Plus" });
    await free.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Free" });
    expect(await free.client.query(api.subscriptions.mine, {})).toEqual({
      plan: "free",
      enforced: true,
      limits: { groups: 0, songs: 0, librarySongs: 10 },
      groups: 0,
      songs: 0,
      librarySongs: 0,
    });
  });

  it("allows Plus 3 Groups and Pro as many as they like, not counting My Library or Groups they joined", async () => {
    const { as } = await setup();
    const plus = await as({ email: "plus@example.com" }, "plus");
    await plus.client.mutation(api.groups.openOffline, {});
    for (const name of ["One", "Two", "Three"]) await plus.client.mutation(api.groups.createGroup, { name, displayName: "Plus" });
    await expect(plus.client.mutation(api.groups.createGroup, { name: "Four", displayName: "Plus" })).rejects.toThrow(/Plus includes 3 Groups/);
    await expect(plus.client.mutation(api.groups.duplicateGroup, { groupId: (await plus.client.query(api.groups.myGroups, {}))[1].groupId })).rejects.toThrow(
      /Plus includes 3 Groups/,
    );
    expect(await plus.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "plus", groups: 3 });

    const pro = await as({ email: "pro@example.com" }, "pro");
    for (let i = 0; i < 5; i++) await pro.client.mutation(api.groups.createGroup, { name: `Band ${i}`, displayName: "Pro" });
    expect(await pro.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "pro", limits: { groups: null, songs: null }, groups: 5 });
  });

  it("treats a subscription past its expiry as Free", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { as } = await setup();
    const lapsed = await as({ email: "lapsed@example.com" }, "pro", 999_999);
    await expect(lapsed.client.mutation(api.groups.createGroup, { name: "Band", displayName: "L" })).rejects.toThrow(/Subscribe/);
  });

  it("never lets a guest create a Group, whatever subscription the account has", async () => {
    const { as } = await setup();
    const guest = await as({ isAnonymous: true }, "pro");
    await expect(guest.client.mutation(api.groups.createGroup, { name: "Band", displayName: "G" })).rejects.toThrow(/Sign in with Google/);
  });
});

describe("Comped plans", () => {
  it("gives the comped emails their plan without a subscription, however the address is typed", async () => {
    expect(compedPlan("Daniel@Example.com", { COMP_PLUS_EMAILS: " daniel@example.com , other@example.com" })).toBe("plus");
    expect(compedPlan("boss@example.com", { COMP_PLUS_EMAILS: "boss@example.com", COMP_PRO_EMAILS: "boss@example.com" })).toBe("pro");
    expect(compedPlan("someone@example.com", { COMP_PLUS_EMAILS: "daniel@example.com" })).toBe("free");
    expect(compedPlan(undefined, { COMP_PLUS_EMAILS: "daniel@example.com" })).toBe("free");
  });

  it("lets a comped account create Groups up to its plan", async () => {
    vi.stubEnv("COMP_PLUS_EMAILS", "comped@example.com");
    const { as } = await setup();
    const comped = await as({ email: "comped@example.com" });
    await comped.client.mutation(api.groups.createGroup, { name: "Band", displayName: "C" });
    expect(await comped.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "plus", groups: 1 });
  });
});

describe("Song limits", () => {
  it("counts Songs across every Group the subscriber created, but not My Library", async () => {
    const { t, as } = await setup();
    const plus = await as({ email: "plus@example.com" }, "plus");
    const first = await plus.client.mutation(api.groups.createGroup, { name: "One", displayName: "P" });
    const second = await plus.client.mutation(api.groups.createGroup, { name: "Two", displayName: "P" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 60; i++) await ctx.db.insert("songs", { groupId: first.groupId, title: `A${i}`, countIn: true, sections: [] });
      for (let i = 0; i < 39; i++) await ctx.db.insert("songs", { groupId: second.groupId, title: `B${i}`, countIn: true, sections: [] });
    });
    const last = await plus.client.mutation(api.songs.createSong, { groupId: second.groupId, title: "Hundredth" });
    await expect(plus.client.mutation(api.songs.createSong, { groupId: first.groupId, title: "Too many" })).rejects.toThrow(/You have|Admin has reached the 100 Songs Plus includes/);
    await expect(plus.client.mutation(api.songs.duplicateSong, { songId: last })).rejects.toThrow(/100 Songs/);
    const libraryId = await plus.client.mutation(api.groups.openOffline, {});
    await plus.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Practice" });
    expect(await plus.client.query(api.subscriptions.mine, {})).toMatchObject({ songs: 100, librarySongs: 1 });
  });

  it("lets My Library hold 10 Songs on Free and 1000 on Plus, whatever goes in by copying", async () => {
    const { t, as, setPlan } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const libraryId = await daniel.client.mutation(api.groups.openOffline, {});
    await t.run(async (ctx) => {
      for (let i = 0; i < 9; i++) await ctx.db.insert("songs", { groupId: libraryId, title: `S${i}`, countIn: true, sections: [] });
    });
    const tenth = await daniel.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Tenth" });
    await expect(daniel.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Eleventh" })).rejects.toThrow(/holds 10 Songs on Free/);
    await expect(daniel.client.mutation(api.songs.duplicateSong, { songId: tenth })).rejects.toThrow(/holds 10 Songs on Free/);

    await setPlan(daniel.userId, "plus");
    await daniel.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Eleventh" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 989; i++) await ctx.db.insert("songs", { groupId: libraryId, title: `P${i}`, countIn: true, sections: [] });
    });
    const band = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "D" });
    const bandSong = await daniel.client.mutation(api.songs.createSong, { groupId: band.groupId, title: "Pure" });
    await expect(daniel.client.mutation(api.songs.copyToGroup, { songId: bandSong, toGroupId: libraryId })).rejects.toThrow(/up to 1000 Songs/);
    expect(await daniel.client.query(api.subscriptions.mine, {})).toMatchObject({ librarySongs: 1000 });
  });

  it("keeps a guest's My Library to the Free 10 Songs", async () => {
    const { t, as } = await setup();
    const guest = await as({ isAnonymous: true });
    const libraryId = await guest.client.mutation(api.groups.openOffline, {});
    await t.run(async (ctx) => {
      for (let i = 0; i < 10; i++) await ctx.db.insert("songs", { groupId: libraryId, title: `S${i}`, countIn: true, sections: [] });
    });
    await expect(guest.client.mutation(api.songs.createSong, { groupId: libraryId, title: "More" })).rejects.toThrow(/holds 10 Songs on Free/);
    expect(await guest.client.query(api.songs.list, { groupId: libraryId })).toHaveLength(10);
    expect(await guest.client.query(api.setlists.list, { groupId: libraryId })).toEqual([]);
  });


  it("charges a Song Manager's additions to the Group's Admin, not to the Song Manager", async () => {
    const { t, as } = await setup();
    const admin = await as({ email: "admin@example.com" }, "plus");
    const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "A" });
    const manager = await as({ email: "manager@example.com" });
    await manager.client.mutation(api.groups.joinGroup, { joinCode, displayName: "M" });
    await admin.client.mutation(api.groups.setRole, { groupId, userId: manager.userId, role: "songManager" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++) await ctx.db.insert("songs", { groupId, title: `S${i}`, countIn: true, sections: [] });
    });
    await expect(manager.client.mutation(api.songs.createSong, { groupId, title: "One more" })).rejects.toThrow(/This Group's Admin has reached the 100 Songs/);
  });
});

describe("Locked Groups", () => {
  async function bandWithMember(plan: "plus" | "pro") {
    const context = await setup();
    const admin = await context.as({ email: "admin@example.com" }, plan);
    const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "A" });
    const member = await context.as({ email: "member@example.com" });
    await member.client.mutation(api.groups.joinGroup, { joinCode, displayName: "M" });
    const songId = await admin.client.mutation(api.songs.createSong, { groupId, title: "Pure" });
    await admin.client.mutation(api.songs.updateSong, { songId, sections: [...demoSong.sections] });
    return { ...context, admin, member, groupId, joinCode, songId };
  }

  it("locks every Group of an Admin whose subscription lapsed, so it can neither play nor change", async () => {
    const { admin, member, groupId, songId, setPlan } = await bandWithMember("plus");
    await setPlan(admin.userId, null);
    expect((await member.client.query(api.groups.myGroups, {}))[0]).toMatchObject({ groupId, locked: true });
    await expect(admin.client.mutation(api.playback.start, { groupId, songId })).rejects.toThrow(/locked until its Admin renews/);
    await expect(admin.client.mutation(api.songs.createSong, { groupId, title: "New" })).rejects.toThrow(/locked/);
    await expect(admin.client.mutation(api.songs.updateSong, { songId, title: "Renamed" })).rejects.toThrow(/locked/);
    await expect(admin.client.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" })).rejects.toThrow(/locked/);
    expect(await member.client.query(api.songs.get, { songId })).toMatchObject({ title: "Pure" });

    await setPlan(admin.userId, "plus");
    expect((await member.client.query(api.groups.myGroups, {}))[0]).toMatchObject({ locked: false });
    await admin.client.mutation(api.playback.start, { groupId, songId });
  });

  it("still lets a Playback Manager stop a Playback that was running when the Group locked", async () => {
    const { admin, groupId, songId, setPlan } = await bandWithMember("plus");
    await admin.client.mutation(api.playback.start, { groupId, songId });
    await setPlan(admin.userId, null);
    await admin.client.mutation(api.playback.stop, { groupId });
  });

  it("keeps the oldest Groups open after a downgrade and locks the rest", async () => {
    const { admin, groupId, setPlan } = await bandWithMember("pro");
    const others = [];
    for (const name of ["Two", "Three", "Four"]) others.push((await admin.client.mutation(api.groups.createGroup, { name, displayName: "A" })).groupId);
    await setPlan(admin.userId, "plus");
    const locked = (await admin.client.query(api.groups.myGroups, {})).map((group) => [group.groupId, group.locked]);
    expect(locked).toEqual([
      [groupId, false],
      [others[0], false],
      [others[1], false],
      [others[2], true],
    ]);
  });

  it("never locks My Library", async () => {
    const { as } = await setup();
    const free = await as({ email: "free@example.com" });
    const libraryId = await free.client.mutation(api.groups.openOffline, {});
    expect((await free.client.query(api.groups.myGroups, {}))[0]).toMatchObject({ groupId: libraryId, locked: false });
    await free.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Etude" });
  });
});

describe("Copying into a locked Group", () => {
  it("refuses to copy a Song into a Group whose Admin's Plan no longer covers it", async () => {
    const { as, setPlan } = await setup();
    const owner = await as({ email: "owner@example.com" }, "pro");
    const band = await owner.client.mutation(api.groups.createGroup, { name: "Band", displayName: "O" });
    const choir = await owner.client.mutation(api.groups.createGroup, { name: "Choir", displayName: "O" });
    const songId = await owner.client.mutation(api.songs.createSong, { groupId: band.groupId, title: "Pure" });
    await setPlan(owner.userId, null);
    await expect(owner.client.mutation(api.songs.copyToGroup, { songId, toGroupId: choir.groupId })).rejects.toThrow(/locked/);
  });
});

describe("RevenueCat sync", () => {
  it("refuses webhooks without the shared secret", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTH", "Bearer s3cret");
    const { t } = await setup();
    const response = await t.fetch("/revenuecat", { method: "POST", body: JSON.stringify({ event: { app_user_id: "x" } }) });
    expect(response.status).toBe(401);
  });

  it("stores the best active plan and keeps a row saying Free once nothing is active", async () => {
    const { t, as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    await t.mutation(internal.subscriptions.store, { userId: daniel.userId, requestedAt: 1, entitled: { plan: "plus", expiresAt: null, store: "app_store" } });
    expect(await daniel.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "plus" });
    await t.mutation(internal.subscriptions.store, { userId: daniel.userId, requestedAt: 2, entitled: { plan: "pro", expiresAt: null, store: "stripe" } });
    expect(await daniel.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "pro" });
    await t.mutation(internal.subscriptions.store, { userId: daniel.userId, requestedAt: 3, entitled: null });
    expect(await daniel.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "free" });
    expect(await t.run((ctx) => ctx.db.query("subscriptions").collect())).toEqual([expect.objectContaining({ plan: null, syncedAt: 3 })]);
  });

  it("ignores a RevenueCat read that started before the one already saved", async () => {
    const { t, as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    expect(await t.mutation(internal.subscriptions.store, { userId: daniel.userId, requestedAt: 20, entitled: { plan: "pro", expiresAt: null } })).toBe("saved");
    expect(await t.mutation(internal.subscriptions.store, { userId: daniel.userId, requestedAt: 10, entitled: null })).toBe("older than saved");
    expect(await daniel.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "pro" });
  });

  it("syncs before answering a webhook, and asks RevenueCat to retry when it cannot read the subscriber", async () => {
    vi.stubEnv("REVENUECAT_WEBHOOK_AUTH", "Bearer s3cret");
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test");
    const { t, as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const subscriber = { subscriber: { entitlements: { plus: { expires_date: null, product_identifier: "plus_monthly" } } } };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(subscriber), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const deliver = () =>
      t.fetch("/revenuecat", { method: "POST", headers: { Authorization: "Bearer s3cret" }, body: JSON.stringify({ event: { app_user_id: daniel.userId } }) });
    expect((await deliver()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`https://api.revenuecat.com/v1/subscribers/${daniel.userId}`, expect.anything());
    expect(await daniel.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "plus" });
    fetchMock.mockImplementation(async () => new Response("down", { status: 503 }));
    expect((await deliver()).status).toBe(500);
    expect(await daniel.client.query(api.subscriptions.mine, {})).toMatchObject({ plan: "plus" });
    vi.unstubAllGlobals();
  });

  it("re-checks every Plan about to expire in one run, however many there are", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test");
    const { t } = await setup();
    await t.run(async (ctx) => {
      for (let i = 0; i < 230; i++) {
        const userId = await ctx.db.insert("users", { email: `member${i}@example.com` });
        await ctx.db.insert("subscriptions", { userId, plan: "plus", expiresAt: 1_000_000_000 + 60_000, syncedAt: 0 });
      }
    });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ subscriber: { entitlements: {} } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await t.action(internal.subscriptions.recheckExpiring, {})).toBe(230);
    expect(fetchMock).toHaveBeenCalledTimes(230);
    vi.unstubAllGlobals();
  });

  it("re-checks Plans about to expire, so a missed renewal does not lock anyone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000);
    vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test");
    const { t, as } = await setup();
    const renewing = await as({ email: "renewing@example.com" }, "plus", 1_000_000_000 + 60_000);
    const later = await as({ email: "later@example.com" }, "plus", 1_000_000_000 + 30 * 24 * 60 * 60_000);
    const renewed = new Date(1_000_000_000 + 31 * 24 * 60 * 60_000).toISOString();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ subscriber: { entitlements: { plus: { expires_date: renewed } } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await t.action(internal.subscriptions.recheckExpiring, {})).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`https://api.revenuecat.com/v1/subscribers/${renewing.userId}`, expect.anything());
    const rows = await t.run((ctx) => ctx.db.query("subscriptions").collect());
    expect(rows.find((row) => row.userId === renewing.userId)?.expiresAt).toBe(Date.parse(renewed));
    expect(rows.find((row) => row.userId === later.userId)?.syncedAt).toBe(0);
    vi.unstubAllGlobals();
  });
});

