/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupGroup() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", profile));
    return t.withIdentity({ subject: `${userId}|session` });
  };
  const admin = await as({ email: "admin@example.com" });
  const { groupId, joinCode } = await admin.mutation(api.groups.createGroup, { name: "Worship", displayName: "Admin" });
  const member = await as({ isAnonymous: true });
  await member.mutation(api.groups.joinGroup, { joinCode, displayName: "Member" });
  const outsider = await as({ isAnonymous: true });
  return { admin, member, outsider, groupId };
}

const goodnessOfGod = { search: [{ title: "Goodness of God", tempo: "63", time_sig: "4/4", key_of: "Ab", artist: { name: "Bethel Music" } }] };

describe("BPM lookup", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lets only the Group's Admins spend the GetSongBPM key", async () => {
    vi.stubEnv("GETSONGBPM_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(goodnessOfGod)));
    vi.stubGlobal("fetch", fetchMock);
    const { admin, member, outsider, groupId } = await setupGroup();
    await expect(member.action(api.bpm.lookup, { groupId, title: "Goodness of God" })).rejects.toThrow(/Only Admins/);
    await expect(outsider.action(api.bpm.lookup, { groupId, title: "Goodness of God" })).rejects.toThrow(/not in this Group/);
    expect(fetchMock).not.toHaveBeenCalled();
    const results = await admin.action(api.bpm.lookup, { groupId, title: "Goodness of God" });
    expect(results).toEqual([{ title: "Goodness of God", artist: "Bethel Music", bpm: 63, beatsPerBar: 4, key: "Ab" }]);
  });

  it("reports a timed-out GetSongBPM request as a timeout", async () => {
    vi.stubEnv("GETSONGBPM_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new DOMException("The operation was aborted", "AbortError"))));
    const { admin, groupId } = await setupGroup();
    await expect(admin.action(api.bpm.lookup, { groupId, title: "Firm Foundation" })).rejects.toThrow(/took too long/);
  });

  it("passes the GetSongBPM request an abort signal", async () => {
    vi.stubEnv("GETSONGBPM_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ search: [] })));
    vi.stubGlobal("fetch", fetchMock);
    const { admin, groupId } = await setupGroup();
    await admin.action(api.bpm.lookup, { groupId, title: "Firm Foundation" });
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the GetSongBPM key in a header instead of the URL", async () => {
    vi.stubEnv("GETSONGBPM_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ search: [] })));
    vi.stubGlobal("fetch", fetchMock);
    const { admin, groupId } = await setupGroup();
    await admin.action(api.bpm.lookup, { groupId, title: "Firm Foundation" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain("test-key");
    expect(new Headers(init?.headers).get("X-API-KEY")).toBe("test-key");
  });

  it("still counts a slow response body as a timeout", async () => {
    vi.stubEnv("GETSONGBPM_API_KEY", "test-key");
    const stalledBody = {
      ok: true,
      status: 200,
      json: async () => Promise.reject(new DOMException("The operation was aborted", "AbortError")),
    };
    vi.stubGlobal("fetch", vi.fn(async () => stalledBody));
    const { admin, groupId } = await setupGroup();
    await expect(admin.action(api.bpm.lookup, { groupId, title: "Firm Foundation" })).rejects.toThrow(/took too long/);
  });
});
