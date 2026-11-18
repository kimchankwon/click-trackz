import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { currentAudioOutput, onAudioOutputChange, type AudioOutput } from "@/audio/audio-output";
import { lastNotifiedSetting, notifyDeviceSetting, onDeviceSetting } from "./device-setting-events";
import { deviceStore } from "./device-store";
import { LATENCY_NUDGE_KEY, latencyNudgeKeyFor, outputNudge } from "./latency";

const CLEARED = "";

const sameOutput = (a: AudioOutput | null, b: AudioOutput | null) => a?.id === b?.id && a?.name === b?.name;

export function useAudioOutput() {
  const [output, setOutput] = useState(currentAudioOutput);
  useEffect(() => {
    const refresh = () => {
      const next = currentAudioOutput();
      setOutput((shown) => (sameOutput(shown, next) ? shown : next));
    };
    refresh();
    const stopWatching = onAudioOutputChange(refresh);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      stopWatching();
      appState.remove();
    };
  }, []);
  return output;
}

const savesInFlight = new Map<string, Promise<boolean>>();

export function saveLatencyNudgeForOutput(nudgeMs: number, output: AudioOutput | null = currentAudioOutput()) {
  const key = latencyNudgeKeyFor(output?.id ?? null);
  const save = (savesInFlight.get(key) ?? Promise.resolve(true)).then(async () => {
    const kept = await deviceStore.set(key, String(nudgeMs)).then(
      () => true,
      () => false,
    );
    notifyDeviceSetting(key, deviceStore.getSync(key) ?? CLEARED);
    return kept;
  });
  savesInFlight.set(key, save);
  void save.then(() => {
    if (savesInFlight.get(key) === save) savesInFlight.delete(key);
  });
  return save;
}

function useHeardNudges(keys: readonly string[]) {
  const watchedKeys = keys.join("\n");
  const subscribe = useCallback(
    (changed: () => void) => {
      const stops = watchedKeys.split("\n").map((watched) => onDeviceSetting(watched, changed));
      return () => stops.forEach((stop) => stop());
    },
    [watchedKeys],
  );
  const notified = useSyncExternalStore(subscribe, () => JSON.stringify(watchedKeys.split("\n").map((watched) => lastNotifiedSetting(watched) ?? null)));
  return useMemo(() => {
    const values: (string | null)[] = JSON.parse(notified);
    const heard = new Map(watchedKeys.split("\n").map((watched, index) => [watched, values[index]]));
    return (key: string) => heard.get(key) ?? deviceStore.getSync(key);
  }, [watchedKeys, notified]);
}

export function useLatencyNudge() {
  const output = useAudioOutput();
  const outputId = output?.id ?? null;
  const key = latencyNudgeKeyFor(outputId);
  const [saveFailed, setSaveFailed] = useState(false);
  const read = useHeardNudges(key === LATENCY_NUDGE_KEY ? [key] : [key, LATENCY_NUDGE_KEY]);
  const { nudgeMs, savedForOutput } = useMemo(() => outputNudge(outputId, read), [outputId, read]);

  const setNudge = useCallback(
    (next: number) => {
      setSaveFailed(false);
      return saveLatencyNudgeForOutput(next, output).then((kept) => {
        if (!kept) setSaveFailed(true);
        return kept;
      });
    },
    [output],
  );

  return { nudgeMs, savedForOutput, output, setNudge, saveFailed };
}
