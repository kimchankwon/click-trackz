import { beforeEach, describe, expect, it, vi } from "vitest";

const updates = vi.hoisted(() => ({
  isEnabled: true,
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
}));

vi.mock("expo-updates", () => updates);

const { newerVersionIsLive, reloadApp } = await import("./app-version");

describe("newerVersionIsLive on a phone", () => {
  beforeEach(() => {
    updates.isEnabled = true;
    updates.checkForUpdateAsync.mockReset();
    updates.fetchUpdateAsync.mockReset();
    updates.reloadAsync.mockReset();
  });

  it("downloads a newer update and reports it ready", async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    updates.fetchUpdateAsync.mockResolvedValue({ isNew: true });
    await expect(newerVersionIsLive()).resolves.toBe(true);
    expect(updates.fetchUpdateAsync).toHaveBeenCalledOnce();
  });

  it("downloads nothing when the server has no newer update", async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: false });
    await expect(newerVersionIsLive()).resolves.toBe(false);
    expect(updates.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it("is not ready when the download is not new", async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });
    updates.fetchUpdateAsync.mockResolvedValue({ isNew: false });
    await expect(newerVersionIsLive()).resolves.toBe(false);
  });

  it("is not ready when the check fails", async () => {
    updates.checkForUpdateAsync.mockRejectedValue(new Error("offline"));
    await expect(newerVersionIsLive()).resolves.toBe(false);
  });

  it("never checks when updates are off, as in a development build", async () => {
    updates.isEnabled = false;
    await expect(newerVersionIsLive()).resolves.toBe(false);
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it("restarts into the downloaded update and ignores a failed restart", async () => {
    updates.reloadAsync.mockRejectedValue(new Error("dev"));
    reloadApp();
    expect(updates.reloadAsync).toHaveBeenCalledOnce();
    await Promise.resolve();
  });
});
