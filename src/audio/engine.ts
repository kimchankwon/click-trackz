import { AudioContext, type AudioBuffer, type GainNode } from "react-native-audio-api";

import { beatsBetween, type Beat, type Playback, type Song } from "@/sync/timeline";

import { builtinVoiceClips, type BuiltinClipKey, type SpeakerId } from "./builtin-voice-clips";
import { audioTimeFor, slewMapping, type ClockMapping } from "./clock-mapping";
import { loadClip } from "./load-clip";
import { outputLatencyMs } from "./output-latency";
import { allClipKeys, clipKeyForSpokenCount, clipKeyForVoiceCue, defaultSpeaker } from "./voice-clips";

const TICK_MS = 25;
const LOOKAHEAD_MS = 200;
const CLICK_MS = 40;

export type CueMix = {
  click: boolean;
  voiceCues: boolean;
  spokenCounts: boolean;
};

export type CueVolumes = {
  click: number;
  voice: number;
};

type Plan = { song: Song; playback: Playback | null };

export class CueAudioEngine {
  private context: AudioContext | null = null;
  private clickBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private volumes: CueVolumes = { click: 0.8, voice: 0.9 };
  private clips = new Map<BuiltinClipKey, AudioBuffer>();
  private speaker: SpeakerId = defaultSpeaker;
  private loadingSpeaker: Promise<void> | null = null;
  private mapping: ClockMapping | null = null;
  private scheduledUntil = -Infinity;
  private voiceBusyUntil = -Infinity;
  private plan: Plan | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private serverNow: () => number | null = () => null;
  mix: CueMix = { click: true, voiceCues: true, spokenCounts: true };

  get enabled() {
    return this.context !== null;
  }

  async enable(serverNow: () => number | null, speaker: SpeakerId) {
    this.serverNow = serverNow;
    if (this.context === null) {
      this.context = new AudioContext();
      await this.context.resume();
      this.clickBus = this.context.createGain();
      this.voiceBus = this.context.createGain();
      this.clickBus.connect(this.context.destination);
      this.voiceBus.connect(this.context.destination);
      this.setVolumes(this.volumes);
    }
    await this.setSpeaker(speaker, true);
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
  }

  async setSpeaker(speaker: SpeakerId, force = false) {
    if (!force && speaker === this.speaker && this.clips.size > 0) return;
    this.speaker = speaker;
    const context = this.context;
    if (context === null) return;
    const loading = (async () => {
      const loaded = new Map<BuiltinClipKey, AudioBuffer>();
      await Promise.all(
        allClipKeys.map(async (key) => {
          loaded.set(key, await loadClip(context, builtinVoiceClips[speaker][key]));
        }),
      );
      if (this.speaker === speaker) this.clips = loaded;
    })();
    this.loadingSpeaker = loading;
    await loading;
  }

  setVolumes(volumes: CueVolumes) {
    this.volumes = volumes;
    if (this.clickBus) this.clickBus.gain.value = volumes.click;
    if (this.voiceBus) this.voiceBus.gain.value = volumes.voice;
  }

  preview(key: BuiltinClipKey) {
    const context = this.context;
    if (context === null) return;
    void (this.loadingSpeaker ?? Promise.resolve()).then(() => this.play(context, key, context.currentTime));
  }

  setServerClock(serverNow: () => number | null) {
    this.serverNow = serverNow;
  }

  setPlan(song: Song, playback: Playback | null) {
    const restarted = playback?.startsAt !== this.plan?.playback?.startsAt;
    this.plan = { song, playback };
    if (restarted) {
      this.scheduledUntil = -Infinity;
      this.voiceBusyUntil = -Infinity;
    }
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.context?.close();
    this.context = null;
    this.clickBus = null;
    this.voiceBus = null;
  }

  private tick() {
    const context = this.context;
    const now = this.serverNow();
    if (context === null || now === null) return;
    this.mapping = slewMapping(this.mapping, context.currentTime * 1000 - now);
    const playback = this.plan?.playback;
    if (!this.plan || !playback) return;
    const from = Math.max(this.scheduledUntil, now);
    const to = now + LOOKAHEAD_MS;
    if (to <= from) return;
    const latency = outputLatencyMs(context);
    for (const beat of beatsBetween(this.plan.song, playback, from, to)) {
      this.schedule(context, beat, audioTimeFor(beat.at, this.mapping, latency));
    }
    this.scheduledUntil = to;
  }

  private schedule(context: AudioContext, beat: Beat, when: number) {
    if (this.mix.click) this.click(context, when, beat.accent);
    if (this.mix.voiceCues && beat.voiceCue) {
      const key = clipKeyForVoiceCue(beat.voiceCue);
      const ends = key ? this.play(context, key, when) : null;
      if (ends !== null) this.voiceBusyUntil = beat.at + ends * 1000;
    }
    if (this.mix.spokenCounts && beat.spokenCount !== null && beat.at >= this.voiceBusyUntil) {
      const key = clipKeyForSpokenCount(beat.spokenCount);
      if (key) this.play(context, key, when);
    }
  }

  private click(context: AudioContext, when: number, accent: boolean) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1_760 : 1_175;
    gain.gain.setValueAtTime(accent ? 0.9 : 0.6, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + CLICK_MS / 1000);
    oscillator.connect(gain);
    gain.connect(this.clickBus ?? context.destination);
    oscillator.start(when);
    oscillator.stop(when + CLICK_MS / 1000);
  }

  private play(context: AudioContext, key: BuiltinClipKey, when: number): number | null {
    const buffer = this.clips.get(key);
    if (!buffer) return null;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.voiceBus ?? context.destination);
    source.start(when);
    return buffer.duration;
  }
}
