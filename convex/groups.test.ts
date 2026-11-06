/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", profile));
    return { userId, client: t.withIdentity({ subject: `${userId}|session` }) };
  };
  return { t, as };
}

describe("Groups", () => {
  it("makes the creator, who must have a real account, the first Admin", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, {
      name: "Sunday band",
      displayName: "Daniel",
    });
    expect(joinCode).toMatch(/^[A-Z2-9]{6}$/);
    const members = await daniel.client.query(api.groups.members, { groupId });
    expect(members).toEqual([expect.objectContaining({ displayName: "Daniel", role: "admin", isGuest: false })]);

    const guest = await as({ isAnonymous: true });
    await expect(guest.client.mutation(api.groups.createGroup, { name: "x", displayName: "G" })).rejects.toThrow(
      /Sign in with Google to create a Group/,
    );
  });

  it("lets anyone signed in, guests included, join with the code, once", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const guest = await as({ isAnonymous: true });
    expect(await guest.client.mutation(api.groups.joinGroup, { joinCode: joinCode.toLowerCase(), displayName: "Jisue" })).toBe(groupId);
    expect(await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jisue" })).toBe(groupId);
    const members = await guest.client.query(api.groups.members, { groupId });
    expect(members.map((m) => [m.displayName, m.role, m.isGuest])).toEqual([
      ["Daniel", "admin", false],
      ["Jisue", "member", true],
    ]);
    await expect(guest.client.mutation(api.groups.joinGroup, { joinCode: "ZZZZZZ", displayName: "J" })).rejects.toThrow(/No Group/);
  });

  it("lets Admins promote signed-in Members, never guests, and never change their own role", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const joanne = await as({ email: "joanne@example.com" });
    const guest = await as({ isAnonymous: true });
    await joanne.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Joanne" });
    await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Minwoo" });

    await expect(joanne.client.mutation(api.groups.setRole, { groupId, userId: guest.userId, role: "admin" })).rejects.toThrow(/Only Admins/);
    await expect(daniel.client.mutation(api.groups.setRole, { groupId, userId: guest.userId, role: "admin" })).rejects.toThrow(/Admins must sign in with Google first/);
    await expect(daniel.client.mutation(api.groups.setRole, { groupId, userId: daniel.userId, role: "member" })).rejects.toThrow(/your own role/);
    await expect(daniel.client.mutation(api.groups.leaveGroup, { groupId })).rejects.toThrow(/last Admin/);

    await daniel.client.mutation(api.groups.setRole, { groupId, userId: joanne.userId, role: "admin" });
    await expect(daniel.client.mutation(api.groups.setRole, { groupId, userId: daniel.userId, role: "member" })).rejects.toThrow(/your own role/);
    await joanne.client.mutation(api.groups.setRole, { groupId, userId: daniel.userId, role: "member" });
    const roles = (await joanne.client.query(api.groups.members, { groupId })).map((m) => [m.displayName, m.role]);
    expect(roles).toEqual([
      ["Daniel", "member"],
      ["Joanne", "admin"],
      ["Minwoo", "member"],
    ]);
    await guest.client.mutation(api.groups.leaveGroup, { groupId });
    await expect(guest.client.query(api.groups.members, { groupId })).rejects.toThrow(/not in this Group/);
  });

  it("lets an Admin remove another Member, who then loses access", async () => {
    const { as } = await setup();
    const admin = await as({ email: "admin@example.com" });
    const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
    const jason = await as({ isAnonymous: true });
    await jason.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jason" });
    await jason.client.mutation(api.presence.heartbeat, { groupId, screenId: "phone", onPlay: true });
    await admin.client.mutation(api.groups.removeMember, { groupId, userId: jason.userId });
    expect(await admin.client.query(api.groups.members, { groupId })).toEqual([expect.objectContaining({ displayName: "Admin" })]);
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([]);
    await expect(jason.client.query(api.groups.members, { groupId })).rejects.toThrow(/not in this Group/);
  });

  it("only lets Admins remove people, and not themselves", async () => {
    const { as } = await setup();
    const admin = await as({ email: "admin@example.com" });
    const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
    const jason = await as({ isAnonymous: true });
    await jason.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jason" });
    await expect(jason.client.mutation(api.groups.removeMember, { groupId, userId: admin.userId })).rejects.toThrow(/Only Admins/);
    await expect(admin.client.mutation(api.groups.removeMember, { groupId, userId: admin.userId })).rejects.toThrow(/Leave Group/);
  });
});
