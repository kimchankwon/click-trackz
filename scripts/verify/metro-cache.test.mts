import { describe, expect, it } from "vitest";

import { metroTmpDir } from "./metro-cache.mts";

const local = { EXPO_PUBLIC_CONVEX_URL: "http://127.0.0.1:3290", EXPO_PUBLIC_DEV_LOGIN: "1" };

describe("metroTmpDir", () => {
  it("keeps Metro's cache inside the verify state folder", () => {
    expect(metroTmpDir("/repo/.verify", local).startsWith("/repo/.verify/metro/")).toBe(true);
  });

  it("reuses the cache for the same app variables in any order", () => {
    expect(metroTmpDir("/s", { EXPO_PUBLIC_DEV_LOGIN: "1", EXPO_PUBLIC_CONVEX_URL: "http://127.0.0.1:3290" })).toBe(metroTmpDir("/s", local));
  });

  it("starts a fresh cache when the backend moves to another port", () => {
    expect(metroTmpDir("/s", { ...local, EXPO_PUBLIC_CONVEX_URL: "http://127.0.0.1:3300" })).not.toBe(metroTmpDir("/s", local));
  });
});
