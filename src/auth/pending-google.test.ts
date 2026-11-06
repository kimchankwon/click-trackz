import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));

const { claimReturnedGoogleCode, readPendingGoogleSignIn, writePendingGoogleSignIn } = await import("./pending-google");

class FakeSessionStorage {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

let sessionStorage: FakeSessionStorage;

beforeEach(() => {
  sessionStorage = new FakeSessionStorage();
  vi.stubGlobal("window", { sessionStorage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("claimReturnedGoogleCode", () => {
  it("exchanges the returned code once, then refuses it on a reload", () => {
    writePendingGoogleSignIn({ startedAt: 1, retried: false });
    expect(claimReturnedGoogleCode()).toBe(true);
    expect(readPendingGoogleSignIn()?.codeClaimed).toBe(true);
    expect(claimReturnedGoogleCode()).toBe(false);
  });

  it("refuses the code when the claim cannot be saved, so a reload cannot replay it", () => {
    writePendingGoogleSignIn({ startedAt: 1, retried: false });
    sessionStorage.failWrites = true;
    expect(claimReturnedGoogleCode()).toBe(false);
    expect(readPendingGoogleSignIn()?.codeClaimed).toBe(false);
  });

  it("refuses a code when this tab never started a Google sign-in", () => {
    expect(claimReturnedGoogleCode()).toBe(false);
  });
});

describe("writePendingGoogleSignIn", () => {
  it("reports whether the marker was saved", () => {
    expect(writePendingGoogleSignIn({ startedAt: 1, retried: false })).toBe(true);
    sessionStorage.failWrites = true;
    expect(writePendingGoogleSignIn({ startedAt: 2, retried: true })).toBe(false);
  });
});
