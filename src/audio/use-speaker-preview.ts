import { useCallback, useEffect, useRef } from "react";

import type { SpeakerId } from "./builtin-voice-clips";
import { CueAudioEngine } from "./engine";

const noClock = () => null;

export function useSpeakerPreview(active: boolean, volume: number) {
  const engine = useRef<CueAudioEngine | null>(null);
  const latestTap = useRef(0);

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
      const tap = ++latestTap.current;
      const stale = () => engine.current !== current || latestTap.current !== tap;
      current.setVolumes({ click: 0, voice: volume });
      void (current.enabled ? current.wake() : current.enable(noClock, speaker))
        .then(async (running) => {
          if (!running || stale()) return;
          await current.setSpeaker(speaker);
          if (!stale()) current.preview("chorus");
        })
        .catch(() => undefined);
    },
    [volume],
  );
}
