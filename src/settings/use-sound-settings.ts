import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SpeakerId } from "@/audio/builtin-voice-clips";
import { defaultSpeaker, isSpeakerId } from "@/audio/voice-clips";
import { errorText } from "@/lib/error-text";
import { api } from "../../convex/_generated/api";
import { defaultSound, type SoundSettings } from "../../convex/sound";
import { useDeviceSetting } from "./use-device-setting";

const SAVE_AFTER_MS = 300;

const isVolume = (value: string): value is string => /^(0(\.\d+)?|1(\.0+)?)$/.test(value);

export type Sound = Omit<SoundSettings, "speaker"> & { speaker: SpeakerId };

export function useSoundSettings() {
  const viewer = useQuery(api.users.viewer, {});
  const setSound = useMutation(api.users.setSound);
  const save = useMemo(
    () =>
      setSound.withOptimisticUpdate((store, { sound }) => {
        const current = store.getQuery(api.users.viewer, {});
        if (current) store.setQuery(api.users.viewer, {}, { ...current, sound });
      }),
    [setSound],
  );
  const [deviceClick] = useDeviceSetting("clickVolume", String(defaultSound.clickVolume), isVolume);
  const [deviceVoice] = useDeviceSetting("voiceVolume", String(defaultSound.voiceVolume), isVolume);
  const [deviceSpeaker] = useDeviceSetting<SpeakerId>("speaker", defaultSpeaker, isSpeakerId);
  const [draft, setDraft] = useState<SoundSettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef<{ sound: SoundSettings; timer: ReturnType<typeof setTimeout> | null } | null>(null);

  const profileSound = viewer?.sound ?? null;
  const sound = useMemo<Sound>(() => {
    const shown = draft ?? profileSound ?? { ...defaultSound, clickVolume: Number(deviceClick), voiceVolume: Number(deviceVoice), speaker: deviceSpeaker };
    return { ...shown, speaker: isSpeakerId(shown.speaker) ? shown.speaker : defaultSpeaker };
  }, [draft, profileSound, deviceClick, deviceVoice, deviceSpeaker]);
  const canSave = viewer !== undefined && viewer !== null;

  const send = useCallback(
    (next: SoundSettings) => {
      pending.current = null;
      save({ sound: next })
        .then(() => setDraft((current) => (current === next ? null : current)))
        .catch((error: unknown) => {
          setDraft((current) => (current === next ? null : current));
          setSaveError(`Your sound settings were not saved, so they may change back. ${errorText(error)}`);
        });
    },
    [save],
  );

  const update = useCallback(
    (patch: Partial<Sound>) => {
      const next = { ...(pending.current?.sound ?? sound), ...patch };
      setSaveError(null);
      setDraft(next);
      if (pending.current?.timer) clearTimeout(pending.current.timer);
      pending.current = { sound: next, timer: canSave ? setTimeout(() => send(next), SAVE_AFTER_MS) : null };
    },
    [sound, canSave, send],
  );

  useEffect(() => {
    const waiting = pending.current;
    if (canSave && waiting !== null && waiting.timer === null) send(waiting.sound);
  }, [canSave, send]);

  const latestSend = useRef(send);
  useEffect(() => {
    latestSend.current = send;
  }, [send]);

  useEffect(
    () => () => {
      const waiting = pending.current;
      if (!waiting || waiting.timer === null) return;
      clearTimeout(waiting.timer);
      latestSend.current(waiting.sound);
    },
    [],
  );

  return { sound, update, saveError };
}
