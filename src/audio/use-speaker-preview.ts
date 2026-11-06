import { useCallback, useEffect, useRef } from "react";

import type { SpeakerId } from "./builtin-voice-clips";
import { CueAudioEngine } from "./engine";

const noClock = () => null;

export function useSpeakerPreview(active: boolean, volume: number) {
  const engine = useRef<CueAudioEngine | null>(null);

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
    (speaker: SpeakerId) => {
      if (!engine.current) engine.current = new CueAudioEngine();
      const current = engine.current;
      current.setVolumes({ click: 0, voice: volume });
      void (current.enabled ? current.wake() : current.enable(noClock, speaker))
        .then(async (running) => {
          if (!running || engine.current !== current) return;
          await current.setSpeaker(speaker);
          current.preview("chorus");
        })
        .catch(() => undefined);
    },
    [volume],
  );
}
