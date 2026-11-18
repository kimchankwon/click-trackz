import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writes: [] as { value: string; settle: (kept: boolean) => void }[],
}));

vi.mock("expo-secure-store", () => ({
  getItem: (key: string) => store.values.get(key) ?? null,
  getItemAsync: async (key: string) => store.values.get(key) ?? null,
  setItemAsync: (key: string, value: string) =>
    new Promise<void>((resolve, reject) => {
      store.writes.push({
        value,
        settle: (kept) => {
          if (!kept) return reject(new Error("Keychain refused the write"));
          store.values.set(key, value);
          resolve();
        },
      });
    }),
}));

vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }));

vi.mock("@/audio/audio-output", () => ({ currentAudioOutput: () => null, onAudioOutputChange: () => () => undefined }));

import { onDeviceSetting } from "./device-setting-events";
import { LATENCY_NUDGE_KEY } from "./latency";
import { saveLatencyNudgeForOutput } from "./use-latency-nudge";

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

const heardValues = () => {
  const heard: string[] = [];
  const stop = onDeviceSetting(LATENCY_NUDGE_KEY, (value) => heard.push(value));
  return { heard, stop };
};

describe("saveLatencyNudgeForOutput", () => {
  beforeEach(() => {
    store.values.clear();
    store.writes.length = 0;
  });

  it("starts a second save only after the first settles, so a late failure cannot hide the newer nudge", async () => {
    const { heard, stop } = heardValues();
    const first = saveLatencyNudgeForOutput(40, null);
    const second = saveLatencyNudgeForOutput(80, null);
    await settled();
    expect(store.writes.map((write) => write.value)).toEqual(["40"]);
    store.writes[0].settle(false);
    await settled();
    expect(store.writes.map((write) => write.value)).toEqual(["40", "80"]);
    store.writes[1].settle(true);
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(heard).toEqual(["40", "", "80"]);
    expect(store.values.get(LATENCY_NUDGE_KEY)).toBe("80");
    stop();
  });

  it("rolls a failed save back to the nudge the device still has", async () => {
    store.values.set(LATENCY_NUDGE_KEY, "120");
    const { heard, stop } = heardValues();
    const save = saveLatencyNudgeForOutput(40, null);
    await settled();
    store.writes[0].settle(false);
    expect(await save).toBe(false);
    expect(heard).toEqual(["40", "120"]);
    stop();
  });
});
