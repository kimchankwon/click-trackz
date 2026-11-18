import { beforeEach, describe, expect, it, vi } from "vitest";

import { lastNotifiedSetting, onDeviceSetting } from "./device-setting-events";
import { LATENCY_NUDGE_KEY, latencyNudgeKeyFor } from "./latency";
import { AUDIO_OUTPUTS_KEY, parseRememberedOutputs } from "./audio-outputs";
import { noteOutputUsed, saveLatencyNudgeForOutput } from "./use-latency-nudge";

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
    expect(heard).toEqual(["40", "", "80", "80"]);
    expect(store.values.get(LATENCY_NUDGE_KEY)).toBe("80");
    stop();
  });

  it("reports the stored nudge once a save lands, for a screen that started watching mid-write", async () => {
    store.values.set(LATENCY_NUDGE_KEY, "120");
    const save = saveLatencyNudgeForOutput(40, null);
    await settled();
    const { heard, stop } = heardValues();
    store.writes[0].settle(true);
    expect(await save).toBe(true);
    expect(heard).toEqual(["40"]);
    stop();
  });

  it("remembers the rolled back nudge for an output no screen is watching", async () => {
    const output = { id: "airpods", name: "AirPods" };
    const key = latencyNudgeKeyFor(output.id);
    store.values.set(key, "150");
    const save = saveLatencyNudgeForOutput(60, output);
    await settled();
    expect(lastNotifiedSetting(key)).toBe("60");
    store.writes[0].settle(false);
    expect(await save).toBe(false);
    expect(lastNotifiedSetting(key)).toBe("150");
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

  it("remembers two outputs connected in quick succession", async () => {
    const first = noteOutputUsed({ id: "airpods", name: "AirPods" });
    const second = noteOutputUsed({ id: "car", name: "Car" });
    await settled();
    expect(store.writes).toHaveLength(1);
    store.writes[0].settle(true);
    await first;
    await settled();
    store.writes[1].settle(true);
    await second;
    expect(parseRememberedOutputs(store.values.get(AUDIO_OUTPUTS_KEY) ?? null).map((output) => output.id).sort()).toEqual(["airpods", "car"]);
  });

  it("keeps remembering outputs after a write fails", async () => {
    const failed = noteOutputUsed({ id: "airpods", name: "AirPods" });
    await settled();
    store.writes[0].settle(false);
    await failed;
    const next = noteOutputUsed({ id: "car", name: "Car" });
    await settled();
    store.writes[1].settle(true);
    await next;
    expect(parseRememberedOutputs(store.values.get(AUDIO_OUTPUTS_KEY) ?? null).map((output) => output.id)).toEqual(["car"]);
  });
});
