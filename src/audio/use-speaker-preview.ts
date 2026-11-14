import { useCallback, useEffect, useRef } from "react";

import type { BuiltinClipKey, SpeakerId, VoiceSpeed } from "./builtin-voice-clips";
import { CueAudioEngine } from "./engine";
import { pickPreviewPhrase } from "./preview-phrase";
import { allClipKeys } from "./voice-clips";

const noClock = () => null;

export function useSpeakerPreview(active: boolean, volume: number) {
  const engine = useRef<CueAudioEngine | null>(null);
  const latestTap = useRef(0);
  const lastPhrase = useRef<BuiltinClipKey | null>(null);

  useEffect(() => {
    if (active) return;
    engine.current?.dispose();
    engine.current = null;
  }, [active]);

  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );

  return useCallback(
    (speaker: SpeakerId, voiceSpeed: VoiceSpeed) => {
      if (!engine.current) engine.current = new CueAudioEngine();
      const current = engine.current;
      const tap = ++latestTap.current;
      const stale = () => engine.current !== current || latestTap.current !== tap;
      current.setVolumes({ click: 0, voice: volume });
      void (current.enabled ? current.wake() : current.enable(noClock, speaker, voiceSpeed))
        .then(async (running) => {
          if (!running || stale()) return;
          await current.setSpeaker(speaker, voiceSpeed);
          if (stale()) return;
          lastPhrase.current = pickPreviewPhrase(allClipKeys, lastPhrase.current);
          current.preview(lastPhrase.current);
        })
        .catch(() => undefined);
    },
    [volume],
  );
}
