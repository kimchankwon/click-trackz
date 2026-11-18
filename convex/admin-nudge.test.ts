/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAD_IN_MS, STOP_LEAD_MS } from "../src/sync/commands";
import { demoSong } from "../src/sync/demo-song";
import { SPEAKER_CHECK_MS } from "../src/sync/speaker-check";
import { api, internal } from "./_generated/api";
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

describe("Song Managers and above nudge other devices", () => {
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

  it("keeps the nudge waiting for a second tab on the same device after the first tab saves it", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0, "tab-1") });
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0, "tab-2") });
    await admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 30 });
    const request = await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: "tab-1" });
    await member.client.mutation(api.presence.nudgeApplied, { groupId, screenId: "tab-1", id: request!.id, nudgeMs: 30 });
    expect(await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: "tab-1" })).toBeNull();
    expect(await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: "tab-2" })).toEqual(expect.objectContaining({ ms: 30 }));
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

  it("lets Song Managers and above nudge, within the Latency nudge range, and only devices still in the Group", async () => {
    const { admin, member, manager, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await expect(member.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 20 })).rejects.toThrow("Only Song Managers and above can do that");
    expect(await member.client.query(api.presence.devices, { groupId })).toBeNull();
    await manager.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 20 });
    expect(await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: MEMBER_PHONE })).toEqual(expect.objectContaining({ ms: 20, byName: "Pat" }));
    await expect(admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 401 })).rejects.toThrow(/from -100 to 400 ms/);
    await expect(admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 2.5 })).rejects.toThrow(/whole number/);
    await expect(admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: "neverseen01", nudgeMs: 20 })).rejects.toThrow("That device is no longer in this Group");
    await member.client.mutation(api.groups.leaveGroup, { groupId });
    await expect(admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 20 })).rejects.toThrow("That device is no longer in this Group");
  });

  it("keeps listing a device after it leaves the Group screen, with its last nudge", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 30) });
    await member.client.mutation(api.presence.leave, { groupId, screenId: MEMBER_PHONE });
    const shown = await admin.client.query(api.presence.devices, { groupId });
    expect(shown?.devices).toEqual([expect.objectContaining({ deviceId: MEMBER_PHONE, displayName: "Sam", deviceLabel: `${MEMBER_PHONE} label`, nudgeMs: 30, pendingMs: null, onPlay: false })]);
  });

  it("holds a nudge for a device that is away and hands it over when the device opens the Group again", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await member.client.mutation(api.presence.leave, { groupId, screenId: MEMBER_PHONE });
    await admin.client.mutation(api.presence.nudgeDevice, { groupId, deviceId: MEMBER_PHONE, nudgeMs: 60 });
    expect((await admin.client.query(api.presence.devices, { groupId }))?.devices[0]).toEqual(expect.objectContaining({ nudgeMs: 0, pendingMs: 60 }));
    vi.setSystemTime(NOW + 60 * 60_000);
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0, "new-screen") });
    const request = await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: "new-screen" });
    expect(request).toEqual({ id: expect.any(String), ms: 60, byName: "Admin" });
    await member.client.mutation(api.presence.nudgeApplied, { groupId, screenId: "new-screen", id: request!.id, nudgeMs: 60 });
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 60, "new-screen") });
    expect(await member.client.query(api.presence.myNudgeRequest, { groupId, screenId: "new-screen" })).toBeNull();
    expect((await admin.client.query(api.presence.devices, { groupId }))?.devices[0]).toEqual(expect.objectContaining({ nudgeMs: 60, pendingMs: null }));
  });

  it("stops listing a device a month after it last opened the Group, and forgets it after three", async () => {
    const { t, admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await member.client.mutation(api.presence.leave, { groupId, screenId: MEMBER_PHONE });
    vi.setSystemTime(NOW + 31 * 24 * 60 * 60_000);
    expect((await admin.client.query(api.presence.devices, { groupId }))?.devices).toEqual([]);
    vi.setSystemTime(NOW + 91 * 24 * 60 * 60_000);
    await t.mutation(internal.presence.forgetOldDevices, {});
    expect(await t.run((ctx) => ctx.db.query("groupDevices").collect())).toEqual([]);
  });

  it("forgets a Member's devices when they are removed or the Group is deleted", async () => {
    const { t, admin, member, manager, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await manager.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_LAPTOP, 0) });
    await admin.client.mutation(api.groups.removeMember, { groupId, userId: member.userId });
    expect((await t.run((ctx) => ctx.db.query("groupDevices").collect())).map((row) => row.deviceId)).toEqual([MEMBER_LAPTOP]);
    await admin.client.mutation(api.groups.deleteGroup, { groupId, pressedAt: NOW });
    expect(await t.run((ctx) => ctx.db.query("groupDevices").collect())).toEqual([]);
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
    await admin.client.mutation(api.speakerCheck.listen, { groupId, deviceId: MEMBER_PHONE, fromDeviceId: ADMIN_PHONE });
    expect(await member.client.query(api.speakerCheck.current, { groupId })).toEqual(
      expect.objectContaining({ listenTo: MEMBER_PHONE, listenToName: `Sam (${MEMBER_PHONE} label)` }),
    );
    await admin.client.mutation(api.speakerCheck.listen, { groupId, deviceId: null, fromDeviceId: ADMIN_PHONE });
    expect(await member.client.query(api.speakerCheck.current, { groupId })).toEqual(expect.objectContaining({ listenTo: null, listenToName: null }));
  });

  it("compares the listened device with the device of whoever pressed Listen", async () => {
    const { admin, member, manager, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, ...beat(MEMBER_PHONE, 0) });
    await admin.client.mutation(api.speakerCheck.start, { groupId, deviceId: ADMIN_PHONE });
    await manager.client.mutation(api.speakerCheck.listen, { groupId, deviceId: MEMBER_PHONE, fromDeviceId: "managerphone" });
    expect(await member.client.query(api.speakerCheck.current, { groupId })).toEqual(expect.objectContaining({ listenTo: MEMBER_PHONE, comparedWith: "managerphone" }));
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
    await expect(admin.client.mutation(api.speakerCheck.listen, { groupId, deviceId: null, fromDeviceId: ADMIN_PHONE })).rejects.toThrow("Start a Speaker check first");
  });

  it("is for Song Managers and above", async () => {
    const { member, manager, groupId } = await setupGroup();
    await expect(member.client.mutation(api.speakerCheck.start, { groupId, deviceId: MEMBER_PHONE })).rejects.toThrow("Only Song Managers and above can do that");
    await manager.client.mutation(api.speakerCheck.start, { groupId, deviceId: "managerphone" });
    expect(await member.client.query(api.speakerCheck.current, { groupId })).toEqual(expect.objectContaining({ comparedWith: "managerphone", startedByName: "Pat" }));
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
