import { useCallback, useEffect, useRef, useState } from "react";
import { useSharedValue } from "react-native-reanimated";

import type { BuiltinClipKey, SpeakerId, VoiceSpeed } from "./builtin-voice-clips";
import { CueAudioEngine, type CueSides, type CueVolumes } from "./engine";
import { beatPhase, offsetFromBeat } from "@/lib/timing-test";

const AHEAD_BEATS = 3;
const noClock = () => null;

export type TimingTestOptions = {
  intervalMs: number;
  latencyNudgeMs: number;
  voiceOffsetMs: number;
  volumes: CueVolumes;
  sides?: CueSides;
  voice?: { speaker: SpeakerId; voiceSpeed: VoiceSpeed; keyFor: (index: number) => BuiltinClipKey | null };
};

export function useTimingTest() {
  const engine = useRef<CueAudioEngine | null>(null);
  const scheduler = useRef<ReturnType<typeof setInterval> | null>(null);
  const frame = useRef<number | null>(null);
  const origin = useRef<{ firstBeatAt: number; intervalMs: number } | null>(null);
  const busy = useRef(false);
  const phase = useSharedValue(-1);
  const [running, setRunning] = useState(false);
  const [tested, setTested] = useState<{ latencyNudgeMs: number; voiceOffsetMs: number } | null>(null);

  const halt = useCallback(() => {
    if (scheduler.current) clearInterval(scheduler.current);
    scheduler.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    origin.current = null;
    engine.current?.stopTimingTest();
    phase.set(-1);
  }, [phase]);

  const stop = useCallback(() => {
    halt();
    busy.current = false;
    setRunning(false);
    setTested(null);
  }, [halt]);

  useEffect(
    () => () => {
      halt();
      engine.current?.dispose();
      engine.current = null;
    },
    [halt],
  );

  const start = useCallback(
    async (options: TimingTestOptions) => {
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
        if (!busy.current) return;
        current.setVolumes(options.volumes);
        if (options.sides) current.setSides(options.sides);
        current.setOffsets(options);
        const firstBeatAt = current.startTimingTest(options.intervalMs);
        origin.current = { firstBeatAt, intervalMs: options.intervalMs };
        current.scheduleTimingBeats(0, AHEAD_BEATS, options.voice?.keyFor);
        let next = AHEAD_BEATS;
        scheduler.current = setInterval(() => {
          const reached = Math.floor((performance.now() - firstBeatAt) / options.intervalMs) + AHEAD_BEATS;
          if (reached < next) return;
          current.scheduleTimingBeats(next, reached - next + 1, options.voice?.keyFor);
          next = reached + 1;
        }, options.intervalMs / 2);
        const draw = () => {
          phase.set(beatPhase(performance.now(), firstBeatAt, options.intervalMs));
          frame.current = requestAnimationFrame(draw);
        };
        frame.current = requestAnimationFrame(draw);
      } catch (error) {
        halt();
        busy.current = false;
        setRunning(false);
        setTested(null);
        throw error;
      }
    },
    [halt, phase],
  );

  const tapOffset = useCallback((atMs: number) => {
    const shown = origin.current;
    return shown === null ? null : offsetFromBeat(atMs, shown.firstBeatAt, shown.intervalMs);
  }, []);

  return { start, stop, running, tested, phase, tapOffset };
}
