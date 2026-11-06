import { describe, expect, it } from "vitest";

import { claimReturnedCode, googleReturnAction } from "./google-return";

const NOW = 1_800_000_000_000;

describe("googleReturnAction", () => {
  it("does nothing when no Google sign-in was started", () => {
    expect(googleReturnAction({ pending: null, now: NOW, isAuthenticated: false })).toBe("none");
  });

  it("forgets the attempt once the Member is signed in", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 5_000, retried: false }, now: NOW, isAuthenticated: true })).toBe("clear");
  });

  it("retries once when Google sent the Member back signed out", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 5_000, retried: false }, now: NOW, isAuthenticated: false })).toBe("retry");
  });

  it("explains the failure after the retry also came back signed out", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 5_000, retried: true }, now: NOW, isAuthenticated: false })).toBe("explain");
  });

  it("ignores an attempt older than ten minutes", () => {
    expect(googleReturnAction({ pending: { startedAt: NOW - 11 * 60_000, retried: false }, now: NOW, isAuthenticated: false })).toBe("clear");
  });
});

describe("claimReturnedCode", () => {
  it("exchanges the code Google sent back for the sign-in this tab started", () => {
    expect(claimReturnedCode({ startedAt: NOW, retried: false })).toEqual({
      exchange: true,
      pending: { startedAt: NOW, retried: false, codeClaimed: true },
    });
  });

  it("refuses to exchange the same code again after a refresh", () => {
    expect(claimReturnedCode({ startedAt: NOW, retried: false, codeClaimed: true })).toEqual({ exchange: false });
  });

  it("ignores a code when this tab never started a Google sign-in", () => {
    expect(claimReturnedCode(null)).toEqual({ exchange: false });
  });

  it("exchanges the retry's code even though the first attempt was claimed", () => {
    expect(claimReturnedCode({ startedAt: NOW, retried: true })).toMatchObject({ exchange: true });
  });
});
