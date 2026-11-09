import { AudioContext, type AudioBuffer, type AudioNode, type GainNode, type StereoPannerNode } from "react-native-audio-api";

import { panOf, type Side } from "@/settings/output";
import { accentLevelOf, beatsBetween, offbeatsOf, subdivisionOf, type AccentLevel, type Beat, type Playback, type Song } from "@/sync/timeline";

import { describeAudioError, describeAudioFailure } from "./audio-failure";
import { preferPlaybackSession, probeAudioSession } from "./audio-session";
import { builtinVoiceClips, type BuiltinClipKey, type SpeakerId } from "./builtin-voice-clips";
import { scheduleTimeFor, slewMapping, type ClockMapping } from "./clock-mapping";
import { loadClip } from "./load-clip";
import { outputLatencyMs } from "./output-latency";
import { chooseClip } from "./clip-choice";
import { allClipKeys, clipKeyForSpokenCount, defaultSpeaker } from "./voice-clips";
import { MAX_VOICE_LEAD_MS, VOICE_EARLY_MS, voiceLeadMs } from "./voice-onset";
import { spokenCountFits, voiceEndsAt } from "./voice-overlap";
import { takePrimedContext } from "./primed-context";

const TICK_MS = 25;
const LOOKAHEAD_MS = 200;
const HIDDEN_LOOKAHEAD_MS = 15 * 60_000;
const FUTURE_PRUNE_MS = 2_000;
const CLICK_MS = 40;
const LONGEST_BEAT_MS = 60_000 / 30;
type ClickLevel = AccentLevel | "offbeat";

const CLICK_SOUND: Record<ClickLevel, { hz: number; gain: number }> = {
  bar: { hz: 1_760, gain: 0.9 },
  group: { hz: 1_480, gain: 0.75 },
  beat: { hz: 1_175, gain: 0.6 },
  offbeat: { hz: 880, gain: 0.3 },
};
const RESUME_WAIT_MS = 1_000;

export type CueMix = {
  click: boolean;
  voiceCues: boolean;
  spokenCounts: boolean;
};

export type CueVolumes = {
  click: number;
  voice: number;
};

export type CueSides = {
  click: Side;
  voice: Side;
};

type Plan = { song: Song; playback: Playback | null };


let tapTestOwner: CueAudioEngine | null = null;

export class CueAudioEngine {
  private context: AudioContext | null = null;
  private clickBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private clickPan: StereoPannerNode | null = null;
  private voicePan: StereoPannerNode | null = null;
  private volumes: CueVolumes = { click: 0.8, voice: 0.9 };
  private sides: CueSides = { click: "both", voice: "both" };
  private clips = new Map<BuiltinClipKey, AudioBuffer>();
  private readonly builtinKeys: ReadonlySet<string> = new Set(allClipKeys);
  private speaker: SpeakerId = defaultSpeaker;
  private clipsSpeaker: SpeakerId | null = null;
  private loadingSpeaker: { speaker: SpeakerId; done: Promise<void> } | null = null;
  private clipGeneration = 0;
  private mapping: ClockMapping | null = null;
  private scheduledUntil = -Infinity;
  private hidden = false;
  private future: { output: AudioNode; beatAt: number; voiceEndsAt?: number }[] = [];
  private voiceBusyUntil = -Infinity;
  private onsets = new WeakMap<AudioBuffer, number>();
  private plan: Plan | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private serverNow: () => number | null = () => null;
  private enabling: Promise<boolean> | null = null;
  private waking: Promise<boolean> | null = null;
  private needsFreshContext = false;
  private disposed = false;
  mix: CueMix = { click: true, voiceCues: true, spokenCounts: true };
  latencyNudgeMs = 0;
  failure: string | null = null;

  get enabled() {
    return this.context !== null;
  }

  get running() {
    return this.context?.state === "running";
  }

  async enable(serverNow: () => number | null, speaker: SpeakerId | null): Promise<boolean> {
    this.serverNow = serverNow;
    if (this.enabling) return this.enabling;
    const enabling = this.startAudio(speaker).finally(() => {
      this.enabling = null;
    });
    this.enabling = enabling;
    return enabling;
  }

  private openContext(): boolean {
    preferPlaybackSession();
    const context = takePrimedContext() ?? new AudioContext();
    if (this.disposed) {
      void context.close();
      return false;
    }
    const clickBus = context.createGain();
    const voiceBus = context.createGain();
    const clickPan = context.createStereoPanner();
    const voicePan = context.createStereoPanner();
    clickBus.connect(clickPan);
    voiceBus.connect(voicePan);
    clickPan.connect(context.destination);
    voicePan.connect(context.destination);
    this.context = context;
    this.clickBus = clickBus;
    this.voiceBus = voiceBus;
    this.clickPan = clickPan;
    this.voicePan = voicePan;
    this.setVolumes(this.volumes);
    this.setSides(this.sides);
    return true;
  }

  private async startAudio(speaker: SpeakerId | null): Promise<boolean> {
    if (this.context === null && !this.openContext()) return false;
    const running = await this.resume();
    try {
      if (speaker !== null) await this.setSpeaker(speaker);
    } finally {
      if (!this.disposed && this.context !== null && this.timer === null) this.timer = setInterval(() => this.tick(), TICK_MS);
    }
    return !this.disposed && this.context !== null && running;
  }

  async resume(): Promise<boolean> {
    const context = this.context;
    if (context === null) return false;
    const isRunning = () => context.state === "running";
    if (isRunning()) {
      this.failure = null;
      this.needsFreshContext = false;
      return true;
    }
    preferPlaybackSession();
    let resumeError: string | null = null;
    const startedAt = performance.now();
    const resumed = context.resume().then(
      () => "resumed" as const,
      (error: unknown) => {
        resumeError = describeAudioError(error);
        return "failed" as const;
      },
    );
    const timeout = new Promise<"timeout">((done) => setTimeout(() => done("timeout"), RESUME_WAIT_MS));
    const outcome = await Promise.race([resumed, timeout]);
    if (this.context !== context) return this.running;
    if (isRunning()) {
      this.failure = null;
      this.needsFreshContext = false;
      return true;
    }
    const sessionError = await probeAudioSession();
    if (this.context !== context) return this.running;
    this.needsFreshContext = true;
    this.failure = describeAudioFailure({
      state: context.state,
      waitedMs: Math.round(performance.now() - startedAt),
      timedOut: outcome === "timeout",
      resumeError,
      sessionError,
    });
    return false;
  }

  wake(): Promise<boolean> {
    const context = this.context;
    if (context === null) return Promise.resolve(false);
    if (context.state === "running") return Promise.resolve(true);
    if (this.waking) return this.waking;
    const waking = (this.needsFreshContext || context.state !== "suspended" ? this.renew() : this.resume()).finally(() => {
      if (this.waking === waking) this.waking = null;
    });
    this.waking = waking;
    return waking;
  }

  private renew(): Promise<boolean> {
    const previous = this.context;
    if (!this.openContext()) return Promise.resolve(false);
    this.mapping = null;
    this.scheduledUntil = -Infinity;
    this.voiceBusyUntil = -Infinity;
    previous?.close().catch(() => undefined);
    if (previous && this.context && previous.sampleRate !== this.context.sampleRate) this.reloadClips();
    return this.resume();
  }

  private reloadClips() {
    this.clipGeneration += 1;
    this.clips = new Map();
    this.clipsSpeaker = null;
    this.loadingSpeaker = null;
    this.onsets = new WeakMap();
    this.setSpeaker(this.speaker).catch(() => undefined);
  }

  debugSnapshot() {
    const context = this.context;
    const now = this.serverNow();
    return {
      state: context?.state ?? "none",
      currentTime: context?.currentTime ?? null,
      aheadMs: now === null || !Number.isFinite(this.scheduledUntil) ? null : Math.round(this.scheduledUntil - now),
      latencyMs: context ? outputLatencyMs(context) : null,
      needsFreshContext: this.needsFreshContext,
      failure: this.failure,
    };
  }

  async setSpeaker(speaker: SpeakerId) {
    this.speaker = speaker;
    const context = this.context;
    if (context === null || this.clipsSpeaker === speaker) return;
    if (this.loadingSpeaker?.speaker === speaker) return this.loadingSpeaker.done;
    this.clips = new Map();
    this.clipsSpeaker = null;
    const generation = this.clipGeneration;
    const done = (async () => {
      const loaded = new Map<BuiltinClipKey, AudioBuffer>();
      await Promise.all(
        allClipKeys.map(async (key) => {
          loaded.set(key, await loadClip(context, builtinVoiceClips[speaker][key]));
        }),
      );
      if (this.speaker !== speaker || this.clipGeneration !== generation) return;
      this.clips = loaded;
      this.clipsSpeaker = speaker;
      this.rescheduleWithClips();
    })();
    const loading = { speaker, done };
    this.loadingSpeaker = loading;
    try {
      await done;
    } finally {
      if (this.loadingSpeaker === loading) this.loadingSpeaker = null;
    }
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
      this.click(context, when, index % 4 === 0 ? "bar" : "beat");
      clickTimesMs.push(nowMs + (when - context.currentTime) * 1000);
    }
    return { clickTimesMs, reportedLatencyMs: outputLatencyMs(context), lastClickInMs: clickTimesMs[clickTimesMs.length - 1] - nowMs };
  }

  setSides(sides: CueSides) {
    this.sides = sides;
    if (this.clickPan) this.clickPan.pan.value = panOf(sides.click);
    if (this.voicePan) this.voicePan.pan.value = panOf(sides.voice);
  }

  get panning() {
    return { click: this.clickPan?.pan.value ?? null, voice: this.voicePan?.pan.value ?? null };
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
    const changed = restarted || song !== this.plan?.song || playback !== this.plan?.playback;
    this.plan = { song, playback };
    const now = this.serverNow();
    if (restarted || (changed && now === null)) {
      this.cancelAfter(restarted && now !== null ? now : -Infinity);
      this.scheduledUntil = -Infinity;
      this.voiceBusyUntil = -Infinity;
    } else if (changed && now !== null && this.scheduledUntil > now + LOOKAHEAD_MS) {
      this.trimTo(now + LOOKAHEAD_MS);
    }
    const stopsAt = playback?.stopsAt ?? null;
    if (stopsAt !== null && this.future.some((entry) => entry.beatAt >= stopsAt)) {
      this.cancelWhere((beatAt) => beatAt >= stopsAt);
      this.voiceBusyUntil = this.latestVoiceEnd();
    }
    if (changed && this.hidden) this.tick();
  }

  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden) {
      this.tick();
      return;
    }
    const now = this.serverNow();
    if (now !== null && this.scheduledUntil > now + LOOKAHEAD_MS) this.trimTo(now + LOOKAHEAD_MS);
  }

  private rescheduleWithClips() {
    const now = this.serverNow();
    if (now === null || this.scheduledUntil <= now + LOOKAHEAD_MS) return;
    this.trimTo(now + LOOKAHEAD_MS);
    if (this.hidden) this.tick();
  }

  private trimTo(until: number) {
    this.cancelAfter(until);
    this.scheduledUntil = until;
    this.voiceBusyUntil = this.latestVoiceEnd();
  }

  private latestVoiceEnd() {
    return this.future.reduce((latest, entry) => Math.max(latest, entry.voiceEndsAt ?? -Infinity), -Infinity);
  }

  private cancelAfter(beatAt: number) {
    this.cancelWhere((at) => at > beatAt);
  }

  private cancelWhere(drop: (beatAt: number) => boolean) {
    const keep: typeof this.future = [];
    for (const entry of this.future) {
      if (!drop(entry.beatAt)) {
        keep.push(entry);
        continue;
      }
      try {
        entry.output.disconnect();
      } catch {
        continue;
      }
    }
    this.future = keep;
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
    if (context === null || now === null || context.state !== "running") return;
    this.mapping = slewMapping(this.mapping, context.currentTime * 1000 - now);
    const playback = this.plan?.playback;
    if (!this.plan || !playback || (tapTestOwner !== null && tapTestOwner !== this)) return;
    const latency = outputLatencyMs(context);
    this.future = this.future.filter((entry) => entry.beatAt > now - FUTURE_PRUNE_MS);
    const from = Math.max(this.scheduledUntil, now);
    const to = now + (this.hidden ? HIDDEN_LOOKAHEAD_MS : LOOKAHEAD_MS) + MAX_VOICE_LEAD_MS + VOICE_EARLY_MS + Math.max(0, latency + this.latencyNudgeMs);
    if (to <= from) return;
    const subdivision = subdivisionOf(this.plan.song);
    const lookback = subdivision > 1 ? LONGEST_BEAT_MS : 0;
    const stopsAt = playback.stopsAt ?? Infinity;
    for (const beat of beatsBetween(this.plan.song, playback, from - lookback, to)) {
      if (beat.at >= from) this.schedule(context, beat, scheduleTimeFor(beat.at, this.mapping, latency, this.latencyNudgeMs));
      if (!this.mix.click) continue;
      for (const at of offbeatsOf(beat, subdivision)) {
        if (at < from || at >= to || at >= stopsAt) continue;
        const output = this.click(context, scheduleTimeFor(at, this.mapping, latency, this.latencyNudgeMs), "offbeat");
        this.future.push({ output, beatAt: at });
      }
    }
    this.scheduledUntil = to;
  }

  private schedule(context: AudioContext, beat: Beat, when: number) {
    const remember = (output: AudioNode | null, voiceEndsAt?: number) => {
      if (output !== null) this.future.push({ output, beatAt: beat.at, voiceEndsAt });
    };
    if (this.mix.click) remember(this.click(context, when, accentLevelOf(beat)));
    if (this.mix.voiceCues && beat.voiceCue) {
      const key = chooseClip(beat.voiceCue, this.builtinKeys);
      const buffer = key ? this.clips.get(key as BuiltinClipKey) : undefined;
      if (buffer) {
        const { leadMs, output } = this.playOnBeat(context, buffer, when);
        this.voiceBusyUntil = voiceEndsAt(beat.at, leadMs, buffer.duration * 1000);
        remember(output, this.voiceBusyUntil);
      }
    }
    if (this.mix.spokenCounts && beat.spokenCount !== null) {
      const key = clipKeyForSpokenCount(beat.spokenCount);
      const buffer = key ? this.clips.get(key) : undefined;
      if (buffer && spokenCountFits(beat.at, this.onsetOf(buffer), this.voiceBusyUntil)) remember(this.playOnBeat(context, buffer, when).output);
    }
  }

  private click(context: AudioContext, when: number, level: ClickLevel) {
    const sound = CLICK_SOUND[level];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = sound.hz;
    gain.gain.setValueAtTime(sound.gain, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + CLICK_MS / 1000);
    oscillator.connect(gain);
    gain.connect(this.clickBus ?? context.destination);
    oscillator.start(when);
    oscillator.stop(when + CLICK_MS / 1000);
    return gain;
  }

  private play(context: AudioContext, key: BuiltinClipKey, when: number): number | null {
    const buffer = this.clips.get(key);
    if (!buffer) return null;
    this.playBuffer(context, buffer, when);
    return buffer.duration;
  }

  private playOnBeat(context: AudioContext, buffer: AudioBuffer, beatAt: number): { leadMs: number; output: AudioNode } {
    const leadMs = this.onsetOf(buffer);
    const output = this.playBuffer(context, buffer, Math.max(context.currentTime, beatAt - leadMs / 1000));
    return { leadMs, output };
  }

  private onsetOf(buffer: AudioBuffer): number {
    const known = this.onsets.get(buffer);
    if (known !== undefined) return known;
    const onset = voiceLeadMs(buffer.getChannelData(0), buffer.sampleRate);
    this.onsets.set(buffer, onset);
    return onset;
  }

  private playBuffer(context: AudioContext, buffer: AudioBuffer, when: number) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.voiceBus ?? context.destination);
    source.start(when);
    return source;
  }
}
