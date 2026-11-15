import { useCallback, useEffect, useRef, useState } from "react";

import type { BuiltinClipKey, SpeakerId, VoiceSpeed } from "./builtin-voice-clips";
import { CueAudioEngine, type CueSides, type CueVolumes } from "./engine";

const FLASH_MS = 140;
const TAIL_MS = 500;
const noClock = () => null;

export type TimingTestOptions = {
  beats: number;
  intervalMs: number;
  latencyNudgeMs: number;
  voiceOffsetMs: number;
  volumes: CueVolumes;
  sides?: CueSides;
  voice?: { speaker: SpeakerId; voiceSpeed: VoiceSpeed; keyFor: (index: number) => BuiltinClipKey | null };
};

export function useTimingTest() {
  const engine = useRef<CueAudioEngine | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const busy = useRef(false);
  const [lit, setLit] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [firstBeatAt, setFirstBeatAt] = useState<number | null>(null);
  const [tested, setTested] = useState<{ latencyNudgeMs: number; voiceOffsetMs: number } | null>(null);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );

  const run = useCallback(async (options: TimingTestOptions) => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    setTested({ latencyNudgeMs: options.latencyNudgeMs, voiceOffsetMs: options.voiceOffsetMs });
    try {
      const current = engine.current ?? new CueAudioEngine();
      engine.current = current;
      const sounding = current.enabled ? await current.wake() : await current.enable(noClock, options.voice?.speaker ?? null, options.voice?.voiceSpeed);
      if (!sounding) throw new Error("This device blocked sound. Check it is not on silent, then try again.");
      if (options.voice) await current.setSpeaker(options.voice.speaker, options.voice.voiceSpeed);
      current.setVolumes(options.volumes);
      if (options.sides) current.setSides(options.sides);
      current.setOffsets(options);
      const { beatTimesMs, lastBeatInMs } = current.timingTest(options.beats, options.intervalMs, options.voice?.keyFor);
      clear();
      setFirstBeatAt(beatTimesMs[0] ?? null);
      beatTimesMs.forEach((at, index) => {
        const inMs = at - performance.now();
        timers.current.push(setTimeout(() => setLit(index), inMs));
        timers.current.push(setTimeout(() => setLit((shown) => (shown === index ? null : shown)), inMs + FLASH_MS));
      });
      timers.current.push(
        setTimeout(() => {
          current.endTapTest();
          setRunning(false);
          setTested(null);
          busy.current = false;
        }, lastBeatInMs + TAIL_MS),
      );
    } catch (error) {
      busy.current = false;
      setRunning(false);
      setTested(null);
      throw error;
    }
  }, []);

  return { run, lit, running, firstBeatAt, tested };
}
