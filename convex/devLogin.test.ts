import { describe, expect, it } from "vitest";

import { devLoginEnabled, secretsMatch } from "./devLogin";

const dev = "https://groovy-grouse-274.ap-southeast-2.convex.cloud";
const prod = "https://small-buffalo-715.ap-southeast-2.convex.cloud";

describe("devLoginEnabled", () => {
  it("needs the secret and a deployment allow-list that names this deployment", () => {
    expect(devLoginEnabled({ DEV_LOGIN_SECRET: "s", DEV_LOGIN_DEPLOYMENT: dev, CONVEX_CLOUD_URL: dev })).toBe(true);
    expect(devLoginEnabled({ DEV_LOGIN_SECRET: "s", CONVEX_CLOUD_URL: dev })).toBe(false);
    expect(devLoginEnabled({ DEV_LOGIN_SECRET: "s", DEV_LOGIN_DEPLOYMENT: dev, CONVEX_CLOUD_URL: prod })).toBe(false);
    expect(devLoginEnabled({ DEV_LOGIN_DEPLOYMENT: dev, CONVEX_CLOUD_URL: dev })).toBe(false);
    expect(devLoginEnabled({ DEV_LOGIN_SECRET: "", DEV_LOGIN_DEPLOYMENT: "", CONVEX_CLOUD_URL: "" })).toBe(false);
  });
});

describe("secretsMatch", () => {
  it("compares whole strings without short-circuiting on length", () => {
    expect(secretsMatch("abc123", "abc123")).toBe(true);
    expect(secretsMatch("abc123", "abc124")).toBe(false);
    expect(secretsMatch("abc", "abc123")).toBe(false);
    expect(secretsMatch("", "")).toBe(true);
    expect(secretsMatch("", "x")).toBe(false);
  });
});
