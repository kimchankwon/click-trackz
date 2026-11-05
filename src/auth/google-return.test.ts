import { describe, expect, it } from "vitest";

import { googleReturnAction } from "./google-return";

const NOW = 1_800_000_000_000;

describe("googleReturnAction", () => {
  it("does nothing when no Google sign-in was started", () => {
    expect(googleReturnAction({ pending: null, now: NOW, isAuthenticated: false, hasCode: false })).toBe("none");
  });

  it("forgets the attempt once the Member is signed in", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 5_000, retried: false }, now: NOW, isAuthenticated: true, hasCode: false })).toBe("clear");
  });

  it("waits while the returned code is still being exchanged", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 5_000, retried: false }, now: NOW, isAuthenticated: false, hasCode: true })).toBe("none");
  });

  it("retries once when Google sent the Member back signed out", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 5_000, retried: false }, now: NOW, isAuthenticated: false, hasCode: false })).toBe("retry");
  });

  it("explains the failure after the retry also came back signed out", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 5_000, retried: true }, now: NOW, isAuthenticated: false, hasCode: false })).toBe("explain");
  });

  it("ignores an attempt older than ten minutes", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 11 * 60_000, retried: false }, now: NOW, isAuthenticated: false, hasCode: false })).toBe("clear");
  });
});
