import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";

import { currentAudioOutput, onAudioOutputChange, type AudioOutput } from "@/audio/audio-output";
import { notifyDeviceSetting, onDeviceSetting } from "./device-setting-events";
import { deviceStore } from "./device-store";
import { isLatencySetting, LATENCY_NUDGE_KEY, latencyNudgeKeyFor, outputNudge } from "./latency";

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

export async function saveLatencyNudgeForOutput(nudgeMs: number, output: AudioOutput | null = currentAudioOutput()) {
  const key = latencyNudgeKeyFor(output?.id ?? null);
  const before = deviceStore.getSync(key);
  try {
    await deviceStore.set(key, String(nudgeMs));
    return true;
  } catch {
    notifyDeviceSetting(key, before ?? CLEARED);
    return false;
  }
}

export function useLatencyNudge() {
  const output = useAudioOutput();
  const outputId = output?.id ?? null;
  const key = latencyNudgeKeyFor(outputId);
  const [heard, setHeard] = useState<Record<string, string | null>>({});
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const keys = key === LATENCY_NUDGE_KEY ? [key] : [key, LATENCY_NUDGE_KEY];
    const stops = keys.map((watched) =>
      onDeviceSetting(watched, (value) => setHeard((shown) => ({ ...shown, [watched]: isLatencySetting(value) ? value : null }))),
    );
    return () => stops.forEach((stop) => stop());
  }, [key]);

  const { nudgeMs, savedForOutput } = useMemo(
    () => outputNudge(outputId, (read) => (read in heard ? heard[read] : deviceStore.getSync(read))),
    [outputId, heard],
  );

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
