// @vitest-environment edge-runtime
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
      /Google or Apple/,
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

  it("lets Admins promote signed-in Members, never guests, and never strands the Group without an Admin", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const joanne = await as({ email: "joanne@example.com" });
    const guest = await as({ isAnonymous: true });
    await joanne.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Joanne" });
    await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Minwoo" });

    await expect(joanne.client.mutation(api.groups.setRole, { groupId, userId: guest.userId, role: "admin" })).rejects.toThrow(/Only Admins/);
    await expect(daniel.client.mutation(api.groups.setRole, { groupId, userId: guest.userId, role: "admin" })).rejects.toThrow(/Google or Apple/);
    await expect(daniel.client.mutation(api.groups.setRole, { groupId, userId: daniel.userId, role: "member" })).rejects.toThrow(/last Admin/);
    await expect(daniel.client.mutation(api.groups.leaveGroup, { groupId })).rejects.toThrow(/last Admin/);

    await daniel.client.mutation(api.groups.setRole, { groupId, userId: joanne.userId, role: "admin" });
    await daniel.client.mutation(api.groups.setRole, { groupId, userId: daniel.userId, role: "member" });
    const roles = (await joanne.client.query(api.groups.members, { groupId })).map((m) => [m.displayName, m.role]);
    expect(roles).toEqual([
      ["Daniel", "member"],
      ["Joanne", "admin"],
      ["Minwoo", "member"],
    ]);
    await guest.client.mutation(api.groups.leaveGroup, { groupId });
    await expect(guest.client.query(api.groups.members, { groupId })).rejects.toThrow(/not in this Group/);
  });
});
