/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("Server clock", () => {
  it("answers signed-in people, guests included, and nobody else", async () => {
    const t = convexTest(schema, modules);
    const guestId = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const guest = t.withIdentity({ subject: `${guestId}|session` });
    expect(typeof (await guest.mutation(api.clock.now, {}))).toBe("number");
    await expect(t.mutation(api.clock.now, {})).rejects.toThrow(/Sign in first/);
  });
});
