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

describe("Colour theme on the profile", () => {
  it("starts without one and keeps the colour a signed-in user saves", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    expect(await daniel.client.query(api.users.viewer, {})).toEqual(expect.objectContaining({ accent: null }));
    await daniel.client.mutation(api.users.setAccent, { accent: "blue" });
    expect(await daniel.client.query(api.users.viewer, {})).toEqual(expect.objectContaining({ accent: "blue" }));
    await daniel.client.mutation(api.users.setAccent, { accent: "pink" });
    expect(await daniel.client.query(api.users.viewer, {})).toEqual(expect.objectContaining({ accent: "pink" }));
  });

  it("refuses a colour that is not in the palette", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    await expect(daniel.client.mutation(api.users.setAccent, { accent: "chartreuse" })).rejects.toThrow(/Unknown colour/);
  });

  it("keeps guests on their device only", async () => {
    const { as } = await setup();
    const guest = await as({ isAnonymous: true });
    await expect(guest.client.mutation(api.users.setAccent, { accent: "teal" })).rejects.toThrow(
      /Sign in with Google to save your colour/,
    );
  });

  it("ignores a stored colour it no longer offers", async () => {
    const { t, as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    await t.run((ctx) => ctx.db.patch(daniel.userId, { accent: "chartreuse" }));
    expect(await daniel.client.query(api.users.viewer, {})).toEqual(expect.objectContaining({ accent: null }));
  });

  it("rejects a signed-out caller", async () => {
    const { t } = await setup();
    await expect(t.mutation(api.users.setAccent, { accent: "red" })).rejects.toThrow(/Sign in to save your colour/);
  });
});

describe("Sound settings on the account", () => {
  const sound = { clickVolume: 0.5, voiceVolume: 0.7, speaker: "alice", click: true, voiceCues: false, spokenCounts: true };

  it("starts empty and keeps what a guest or a signed-in user saves", async () => {
    const { as } = await setup();
    for (const profile of [{ email: "daniel@example.com" }, { isAnonymous: true }]) {
      const person = await as(profile);
      expect(await person.client.query(api.users.viewer, {})).toEqual(expect.objectContaining({ sound: null }));
      await person.client.mutation(api.users.setSound, { sound });
      expect(await person.client.query(api.users.viewer, {})).toEqual(expect.objectContaining({ sound }));
    }
  });

  it("keeps volumes between 0 and 1", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    await daniel.client.mutation(api.users.setSound, { sound: { ...sound, clickVolume: 3, voiceVolume: -1 } });
    expect((await daniel.client.query(api.users.viewer, {}))?.sound).toEqual(expect.objectContaining({ clickVolume: 1, voiceVolume: 0 }));
  });
});
