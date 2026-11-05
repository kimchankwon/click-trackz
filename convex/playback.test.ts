// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000;

async function signedIn() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return t.withIdentity({ subject: `${userId}|session` });
}

describe("demo Playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("starts one Lead-in after the server receives Start", async () => {
    const member = await signedIn();
    await member.mutation(api.playback.start, {});
    const playback = await member.query(api.playback.current, {});
    expect(playback).toMatchObject({ startsAt: NOW + 2_000, startSection: 0, jumps: [], stopsAt: null });
  });

  it("lands a next-bar Jump on the first bar line at least one second away", async () => {
    const member = await signedIn();
    await member.mutation(api.playback.start, {});
    const startsAt = NOW + 2_000;
    vi.setSystemTime(startsAt + 3_000);
    await member.mutation(api.playback.jump, { toSection: 3, mode: "nextBar" });
    const playback = await member.query(api.playback.current, {});
    expect(playback?.jumps).toEqual([{ at: startsAt + 5_000, toSection: 3 }]);
  });

  it("lands Stop on the first bar line at least one second away", async () => {
    const member = await signedIn();
    await member.mutation(api.playback.start, {});
    const startsAt = NOW + 2_000;
    vi.setSystemTime(startsAt + 6_200);
    await member.mutation(api.playback.stop, {});
    const playback = await member.query(api.playback.current, {});
    expect(playback?.stopsAt).toBe(startsAt + 7_500);
  });

  it("refuses Playback commands and reads from someone who is not signed in", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.playback.start, {})).rejects.toThrow(/Sign in/);
    await expect(t.query(api.playback.current, {})).rejects.toThrow(/Sign in/);
  });
});
