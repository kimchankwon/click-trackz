/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAD_IN_MS, STOP_LEAD_MS } from "../src/sync/commands";
import { demoSong } from "../src/sync/demo-song";
import { SPEAKER_CHECK_MS } from "../src/sync/speaker-check";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000;
const ADMIN_PHONE = "adminphone01";
const MEMBER_PHONE = "memberphone1";
const MEMBER_LAPTOP = "memberlaptop";

async function setupGroup() {
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
  const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  const member = await as({ isAnonymous: true });
  await member.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Sam" });
  const manager = await as({ email: "manager@example.com" });
  await manager.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Pat" });
  await admin.client.mutation(api.groups.setRole, { groupId, userId: manager.userId, role: "groupManager" });
  return { t, admin, member, manager, groupId };
}

const beat = (deviceId: string, nudgeMs: number, screenId = deviceId) => ({ screenId, onPlay: true, deviceId, deviceLabel: `${deviceId} label`, nudgeMs });

describe("Admins nudge other devices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("shows the Admin every device on the Group screen with the nudge it reports", async () => {
    const { admin, member, groupId } = await setupGroup();
    await admin.client.mutation(api.presence.heartbeat, { groupId, ...beat(ADMIN_PHONE, 0) });
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 30) });
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_LAPTOP, 120) });
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "old-app", onPlay: false });
    const shown = await admin.client.query(api.presence.devices, { groupId });
    expect(shown?.devices.map(({ deviceId, displayName, nudgeMs, pendingMs }) => ({ deviceId, displayName, nudgeMs, pendingMs }))).toEqual([
      { deviceId: ADMIN_PHONE, displayName: "Admin", nudgeMs: 0, pendingMs: null },
      { deviceId: MEMBER_PHONE, displayName: "Sam", nudgeMs: 30, pendingMs: null },
      { deviceId: MEMBER_LAPTOP, displayName: "Sam", nudgeMs: 120, pendingMs: null },
    ]);
    expect(shown?.olderApps).toEqual([]);
  });

  it("lists Members whose app does not report a device yet", async () => {
    const { admin, manager, groupId } = await setupGroup();
    await manager.client.mutation(api.presence.heartbeat, { groupId, screenId: "old-app", onPlay: true });
    const shown = await admin.client.query(api.presence.devices, { groupId });
    expect(shown?.olderApps).toEqual([{ userId: manager.userId, displayName: "Pat", seenAt: expect.any(Number) }]);
  });

  it("shows two screens on one device once", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 30, "tab-1") });
    vi.setSystemTime(NOW + 1_000);
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 40, "tab-2") });
    const shown = await admin.client.query(api.presence.devices, { groupId });
    expect(shown?.devices).toEqual([expect.objectContaining({ deviceId: MEMBER_PHONE, nudgeMs: 40 })]);
  });

  it("sends the Admin's nudge to that device and clears it once the device saves it", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 45 });
    const request = await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: MEMBER_PHONE });
    expect(request).toEqual({ id: expect.any(String), ms: 45, byName: "Admin" });
    expect((await admin.client.query(api.presence.devices, { groupId }))?.devices[0]).toEqual(expect.objectContaining({ nudgeMs: 0, pendingMs: 45 }));
    await member.client.mutation(api.presence.nudgeApplied, { groupId, screenId: MEMBER_PHONE, id: request!.id, nudgeMs: 45 });
    expect(await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: MEMBER_PHONE })).toBeNull();
    expect((await admin.client.query(api.presence.devices, { groupId }))?.devices[0]).toEqual(expect.objectContaining({ nudgeMs: 45, pendingMs: null }));
  });

  it("keeps a newer nudge waiting when the device saves an older one", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 10 });
    const first = await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: MEMBER_PHONE });
    await admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 20 });
    await member.client.mutation(api.presence.nudgeApplied, { groupId, screenId: MEMBER_PHONE, id: first!.id, nudgeMs: 10 });
    expect(await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: MEMBER_PHONE })).toEqual(expect.objectContaining({ ms: 20 }));
  });

  it("lets only the Admin nudge, within the Latency nudge range, and only devices still there", async () => {
    const { admin, member, manager, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await expect(manager.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 20 })).rejects.toThrow("Only the Admin can do that");
    expect(await manager.client.query(api.presence.devices, { groupId })).toBeNull();
    await expect(admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 401 })).rejects.toThrow(/from -100 to 400 ms/);
    await expect(admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 2.5 })).rejects.toThrow(/whole number/);
    await member.client.mutation(api.presence.leave, { groupId, screenId: MEMBER_PHONE });
    await expect(admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 20 })).rejects.toThrow("That device has left the Group screen");
  });

  it("refuses a device id this app would not make", async () => {
    const { member, groupId } = await setupGroup();
    await expect(member.client.mutation(api.presence.heartbeat, { groupId, ...beat("Bad Id!", 0) })).rejects.toThrow("not one this app makes");
  });
});

describe("Speaker check", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("starts a lead-in from now and runs for the check length, compared with the Admin's device", async () => {
    const { admin, member, groupId } = await setupGroup();
    await admin.client.mutation(api.speakerCheck.start, { groupId, deviceId: ADMIN_PHONE, pressedAt: NOW });
    const check = await member.client.query(api.speakerCheck.current, { groupId });
    expect(check!.startsAt - NOW).toBeGreaterThanOrEqual(LEAD_IN_MS);
    expect(check!.startsAt - NOW).toBeLessThan(LEAD_IN_MS + 10);
    expect(check).toEqual({
      startsAt: check!.startsAt,
      stopsAt: check!.startsAt + SPEAKER_CHECK_MS,
      comparedWith: ADMIN_PHONE,
      listenTo: null,
      listenToName: null,
      startedByName: "Admin",
    });
  });

  it("listens to one device, then everyone again", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await admin.client.mutation(api.speakerCheck.start, { groupId, deviceId: ADMIN_PHONE });
    await admin.client.mutation(api.speakerCheck.listen, { groupId, deviceId: MEMBER_PHONE });
    expect(await member.client.query(api.speakerCheck.current, { groupId })).toEqual(
      expect.objectContaining({ listenTo: MEMBER_PHONE, listenToName: `Sam (${MEMBER_PHONE} label)` }),
    );
    await admin.client.mutation(api.speakerCheck.listen, { groupId, deviceId: null });
    expect(await member.client.query(api.speakerCheck.current, { groupId })).toEqual(expect.objectContaining({ listenTo: null, listenToName: null }));
  });

  it("stops a stop lead after the press", async () => {
    const { admin, member, groupId } = await setupGroup();
    await admin.client.mutation(api.speakerCheck.start, { groupId, deviceId: ADMIN_PHONE });
    vi.setSystemTime(NOW + 5_000);
    await admin.client.mutation(api.speakerCheck.stop, { groupId });
    const stopsAt = (await member.client.query(api.speakerCheck.current, { groupId }))!.stopsAt;
    expect(stopsAt - (NOW + 5_000 + STOP_LEAD_MS)).toBeGreaterThanOrEqual(0);
    expect(stopsAt - (NOW + 5_000 + STOP_LEAD_MS)).toBeLessThan(10);
    vi.setSystemTime(NOW + 10_000);
    await expect(admin.client.mutation(api.speakerCheck.listen, { groupId, deviceId: null })).rejects.toThrow("Start a Speaker check first");
  });

  it("is for the Admin only", async () => {
    const { manager, groupId } = await setupGroup();
    await expect(manager.client.mutation(api.speakerCheck.start, { groupId, deviceId: ADMIN_PHONE })).rejects.toThrow("Only the Admin can do that");
  });

  it("waits for a Playback to end, and a Playback start ends it", async () => {
    const { admin, member, groupId } = await setupGroup();
    const songId = await admin.client.mutation(api.songs.createSong, { groupId, title: "Demo" });
    await admin.client.mutation(api.songs.updateSong, { songId, sections: [...demoSong.sections] });
    await admin.client.mutation(api.speakerCheck.start, { groupId, deviceId: ADMIN_PHONE });
    await admin.client.mutation(api.playback.start, { groupId, songId });
    expect(await member.client.query(api.speakerCheck.current, { groupId })).toBeNull();
    await expect(admin.client.mutation(api.speakerCheck.start, { groupId, deviceId: ADMIN_PHONE })).rejects.toThrow("Stop the Playback");
  });

  it("goes when the Group is deleted", async () => {
    const { t, admin, groupId } = await setupGroup();
    await admin.client.mutation(api.speakerCheck.start, { groupId, deviceId: ADMIN_PHONE });
    await admin.client.mutation(api.groups.deleteGroup, { groupId });
    expect(await t.run((ctx) => ctx.db.query("speakerChecks").collect())).toEqual([]);
  });
});
