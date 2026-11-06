/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Queries older installed apps still call", () => {
  it("answers with no recordings and the Group's vocabulary, for Members only", async () => {
    const t = convexTest(schema, modules);
    const adminId = await t.run((ctx) => ctx.db.insert("users", { email: "admin@example.com" }));
    const strangerId = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const admin = t.withIdentity({ subject: `${adminId}|session` });
    const stranger = t.withIdentity({ subject: `${strangerId}|session` });
    const { groupId } = await admin.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });

    expect(await admin.query(api.recordings.list, { groupId })).toEqual([]);
    expect(await admin.query(api.recordings.vocabulary, { groupId })).toEqual(await admin.query(api.vocabulary.list, { groupId }));
    await expect(stranger.query(api.recordings.list, { groupId })).rejects.toThrow(/not in this Group/);
  });
});
