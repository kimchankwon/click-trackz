import { AudioContext, type AudioBuffer, type GainNode } from "react-native-audio-api";

import { beatsBetween, type Beat, type Playback, type Song } from "@/sync/timeline";

import { builtinVoiceClips, type BuiltinClipKey, type SpeakerId } from "./builtin-voice-clips";
import { scheduleTimeFor, slewMapping, type ClockMapping } from "./clock-mapping";
import { loadClip } from "./load-clip";
import { outputLatencyMs } from "./output-latency";
import { chooseClip } from "./clip-choice";
import { allClipKeys, clipKeyForSpokenCount, defaultSpeaker } from "./voice-clips";

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

const SPOKEN_COUNT_OVERLAP_MS = 100;

let tapTestOwner: CueAudioEngine | null = null;

export class CueAudioEngine {
  private context: AudioContext | null = null;
  private clickBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private volumes: CueVolumes = { click: 0.8, voice: 0.9 };
  private clips = new Map<BuiltinClipKey, AudioBuffer>();
  private uploads = new Map<string, AudioBuffer>();
  private uploadUrls = new Map<string, string>();
  private readonly builtinKeys: ReadonlySet<string> = new Set(allClipKeys);
  private speaker: SpeakerId = defaultSpeaker;
  private clipsSpeaker: SpeakerId | null = null;
  private loadingSpeaker: { speaker: SpeakerId; done: Promise<void> } | null = null;
  private mapping: ClockMapping | null = null;
  private scheduledUntil = -Infinity;
  private voiceBusyUntil = -Infinity;
  private plan: Plan | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private serverNow: () => number | null = () => null;
  private enabling: Promise<void> | null = null;
  private disposed = false;
  mix: CueMix = { click: true, voiceCues: true, spokenCounts: true };
  latencyNudgeMs = 0;

  get enabled() {
    return this.context !== null;
  }

  async enable(serverNow: () => number | null, speaker: SpeakerId | null) {
    this.serverNow = serverNow;
    if (this.enabling) return this.enabling;
    const enabling = this.startAudio(speaker).finally(() => {
      this.enabling = null;
    });
    this.enabling = enabling;
    return enabling;
  }

  private async startAudio(speaker: SpeakerId | null) {
    const firstTime = this.context === null;
    if (firstTime) {
      const context = new AudioContext();
      try {
        await context.resume();
      } catch (error) {
        void context.close();
        throw error;
      }
      if (this.disposed) {
        void context.close();
        return;
      }
      const clickBus = context.createGain();
      const voiceBus = context.createGain();
      clickBus.connect(context.destination);
      voiceBus.connect(context.destination);
      this.context = context;
      this.clickBus = clickBus;
      this.voiceBus = voiceBus;
      this.setVolumes(this.volumes);
    }
    if (speaker !== null) await this.setSpeaker(speaker);
    if (this.disposed || this.context === null) return;
    if (this.timer === null) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  async setSpeaker(speaker: SpeakerId) {
    this.speaker = speaker;
    const context = this.context;
    if (context === null || this.clipsSpeaker === speaker) return;
    if (this.loadingSpeaker?.speaker === speaker) return this.loadingSpeaker.done;
    this.clips = new Map();
    this.clipsSpeaker = null;
    const done = (async () => {
      const loaded = new Map<BuiltinClipKey, AudioBuffer>();
      await Promise.all(
        allClipKeys.map(async (key) => {
          loaded.set(key, await loadClip(context, builtinVoiceClips[speaker][key]));
        }),
      );
      if (this.speaker !== speaker) return;
      this.clips = loaded;
      this.clipsSpeaker = speaker;
    })();
    const loading = { speaker, done };
    this.loadingSpeaker = loading;
    try {
      await done;
    } finally {
      if (this.loadingSpeaker === loading) this.loadingSpeaker = null;
    }
  }

  async setUploads(recordings: readonly { key: string; url: string | null }[]) {
    const wanted = new Map(recordings.filter((r) => r.url !== null).map((r) => [r.key, r.url as string]));
    for (const key of [...this.uploads.keys()]) {
      if (wanted.get(key) !== this.uploadUrls.get(key)) {
        this.uploads.delete(key);
        this.uploadUrls.delete(key);
      }
    }
    const context = this.context;
    if (context === null) return;
    await Promise.all(
      [...wanted].map(async ([key, url]) => {
        if (this.uploadUrls.get(key) === url) return;
        try {
          const buffer = await loadClip(context, url);
          this.uploads.set(key, buffer);
          this.uploadUrls.set(key, url);
        } catch {
          return;
        }
      }),
    );
  }

  previewUpload(key: string) {
    const context = this.context;
    const buffer = this.uploads.get(key);
    if (context && buffer) this.playBuffer(context, buffer, context.currentTime);
  }

  tapTestRound(clicks: number, intervalMs: number): { clickTimesMs: number[]; reportedLatencyMs: number; lastClickInMs: number } {
    const context = this.context;
    if (context === null) throw new Error("Enable sound first");
    tapTestOwner = this;
    const firstAt = context.currentTime + 0.8;
    const nowMs = performance.now();
    const clickTimesMs: number[] = [];
    for (let index = 0; index < clicks; index++) {
      const when = firstAt + (index * intervalMs) / 1000;
      this.click(context, when, index % 4 === 0);
      clickTimesMs.push(nowMs + (when - context.currentTime) * 1000);
    }
    return { clickTimesMs, reportedLatencyMs: outputLatencyMs(context), lastClickInMs: clickTimesMs[clickTimesMs.length - 1] - nowMs };
  }

  setVolumes(volumes: CueVolumes) {
    this.volumes = volumes;
    if (this.clickBus) this.clickBus.gain.value = volumes.click;
    if (this.voiceBus) this.voiceBus.gain.value = volumes.voice;
  }

  preview(key: BuiltinClipKey) {
    const context = this.context;
    if (context === null) return;
    void (this.loadingSpeaker?.done ?? Promise.resolve()).then(
      () => this.play(context, key, context.currentTime),
      () => undefined,
    );
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

  endTapTest() {
    if (tapTestOwner === this) tapTestOwner = null;
  }

  dispose() {
    this.disposed = true;
    this.endTapTest();
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
    if (!this.plan || !playback || (tapTestOwner !== null && tapTestOwner !== this)) return;
    const latency = outputLatencyMs(context);
    const from = Math.max(this.scheduledUntil, now);
    const to = now + LOOKAHEAD_MS + Math.max(0, latency + this.latencyNudgeMs);
    if (to <= from) return;
    for (const beat of beatsBetween(this.plan.song, playback, from, to)) {
      this.schedule(context, beat, scheduleTimeFor(beat.at, this.mapping, latency, this.latencyNudgeMs));
    }
    this.scheduledUntil = to;
  }

  private schedule(context: AudioContext, beat: Beat, when: number) {
    if (this.mix.click) this.click(context, when, beat.accent);
    if (this.mix.voiceCues && beat.voiceCue) {
      const uploadRefs = Object.fromEntries([...this.uploads.keys()].map((key) => [key, key]));
      const choice = chooseClip(beat.voiceCue, uploadRefs, this.builtinKeys);
      const buffer =
        choice?.source === "upload" ? this.uploads.get(choice.ref) : choice ? this.clips.get(choice.ref as BuiltinClipKey) : undefined;
      if (buffer) {
        this.playBuffer(context, buffer, when);
        this.voiceBusyUntil = beat.at + buffer.duration * 1000;
      }
    }
    if (this.mix.spokenCounts && beat.spokenCount !== null && beat.at >= this.voiceBusyUntil - SPOKEN_COUNT_OVERLAP_MS) {
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
    this.playBuffer(context, buffer, when);
    return buffer.duration;
  }

  private playBuffer(context: AudioContext, buffer: AudioBuffer, when: number) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.voiceBus ?? context.destination);
    source.start(when);
  }
}
