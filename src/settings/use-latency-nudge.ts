import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

import { currentAudioOutput, onAudioOutputChange, type AudioOutput } from "@/audio/audio-output";
import { notifyDeviceSetting, onDeviceSetting } from "./device-setting-events";
import { deviceStore } from "./device-store";
import { AUDIO_OUTPUTS_KEY, parseRememberedOutputs, rememberOutput, type RememberedOutput } from "./audio-outputs";
import { isLatencySetting, LATENCY_NUDGE_KEY, latencyNudgeKeyFor, outputNudge, type OutputNudge } from "./latency";

const CLEARED = "";

const sameOutput = (a: AudioOutput | null, b: AudioOutput | null) => a?.id === b?.id && a?.name === b?.name;

function noteOutputUsed(output: AudioOutput | null) {
  if (output === null) return;
  const next = rememberOutput(parseRememberedOutputs(deviceStore.getSync(AUDIO_OUTPUTS_KEY)), output, Date.now());
  if (next !== null) deviceStore.set(AUDIO_OUTPUTS_KEY, JSON.stringify(next)).catch(() => undefined);
}

export function useRememberedOutputs(): RememberedOutput[] {
  const [stored, setStored] = useState(() => deviceStore.getSync(AUDIO_OUTPUTS_KEY));
  useEffect(() => onDeviceSetting(AUDIO_OUTPUTS_KEY, setStored), []);
  return useMemo(() => parseRememberedOutputs(stored), [stored]);
}

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
  useEffect(() => noteOutputUsed(output), [output]);
  return output;
}

const savesInFlight = new Map<string, Promise<boolean>>();

export function saveLatencyNudgeForOutput(nudgeMs: number, output: AudioOutput | null = currentAudioOutput()) {
  const key = latencyNudgeKeyFor(output?.id ?? null);
  const save = (savesInFlight.get(key) ?? Promise.resolve(true)).then(async () => {
    try {
      await deviceStore.set(key, String(nudgeMs));
      return true;
    } catch {
      notifyDeviceSetting(key, deviceStore.getSync(key) ?? CLEARED);
      return false;
    }
  });
  savesInFlight.set(key, save);
  void save.then(() => {
    if (savesInFlight.get(key) === save) savesInFlight.delete(key);
  });
  return save;
}

function useHeardNudges(keys: readonly string[]) {
  const watchedKeys = keys.join("\n");
  const [heard, setHeard] = useState<{ forKeys: string; values: Record<string, string | null> }>({ forKeys: watchedKeys, values: {} });
  useEffect(() => {
    const stops = watchedKeys.split("\n").map((watched) =>
      onDeviceSetting(watched, (value) =>
        setHeard((shown) => ({
          forKeys: watchedKeys,
          values: { ...(shown.forKeys === watchedKeys ? shown.values : {}), [watched]: isLatencySetting(value) ? value : null },
        })),
      ),
    );
    return () => stops.forEach((stop) => stop());
  }, [watchedKeys]);
  return useCallback(
    (key: string) => {
      const values = heard.forKeys === watchedKeys ? heard.values : {};
      return key in values ? values[key] : deviceStore.getSync(key);
    },
    [heard, watchedKeys],
  );
}

export function useOutputNudges(outputs: readonly AudioOutput[]): Record<string, OutputNudge> {
  const read = useHeardNudges([LATENCY_NUDGE_KEY, ...outputs.map((output) => latencyNudgeKeyFor(output.id))]);
  return useMemo(() => Object.fromEntries(outputs.map((output) => [output.id, outputNudge(output.id, read)])), [outputs, read]);
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
