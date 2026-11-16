import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Song } from "@/sync/timeline";

const fake = vi.hoisted(() => {
  class FakeParam {
    value = 1;
    setValueAtTime(_value: number, startTime: number) {
      if (startTime < 0) throw new RangeError(`startTime must be a finite non-negative number: ${startTime}`);
      return this;
    }
    exponentialRampToValueAtTime(_value: number, endTime: number) {
      if (endTime <= 0) throw new RangeError(`endTime must be a finite non-negative number: ${endTime}`);
      return this;
    }
  }
  class FakeNode {
    disconnected = false;
    connect() {
      return this;
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  class FakeGain extends FakeNode {
    gain = new FakeParam();
  }
  class FakePanner extends FakeNode {
    pan = new FakeParam();
  }
  class FakeShaper extends FakeNode {
    curve: Float32Array | null = null;
  }
  class FakeOscillator extends FakeNode {
    frequency = new FakeParam();
    startedAt: number | null = null;
    start(when: number) {
      if (when < 0) throw new RangeError(`when must be a finite non-negative number: ${when}`);
      this.startedAt = when;
    }
    stop() {}
  }
  class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    state = "suspended";
    currentTime = 0;
    sampleRate = 48_000;
    destination = new FakeNode();
    gains: FakeGain[] = [];
    oscillatorNodes: FakeOscillator[] = [];
    voiceStarts: number[] = [];
    sources: { disconnected: boolean }[] = [];
    constructor() {
      FakeAudioContext.instances.push(this);
    }
    createGain() {
      const gain = new FakeGain();
      this.gains.push(gain);
      return gain;
    }
    createStereoPanner() {
      return new FakePanner();
    }
    createWaveShaper() {
      return new FakeShaper();
    }
    createOscillator() {
      const oscillator = new FakeOscillator();
      this.oscillatorNodes.push(oscillator);
      return oscillator;
    }
    createBufferSource() {
      const voiceStarts = this.voiceStarts;
      const sources = this.sources;
      const source = {
        buffer: null as unknown,
        connect() {
          return source;
        },
        disconnected: false,
        disconnect() {
          source.disconnected = true;
          return undefined;
        },
        start(when: number) {
          voiceStarts.push(when);
          sources.push(source);
        },
      };
      return source;
    }
    resume() {
      return Promise.resolve().then(() => {
        if (this.state !== "closed") this.state = "running";
      });
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
    suspend() {
      if (this.state !== "closed") this.state = "suspended";
      return Promise.resolve();
    }
  }
  const loadClip = vi.fn(async (context: { sampleRate: number }, source: unknown) => ({
    duration: 0.5,
    sampleRate: context.sampleRate,
    source,
    getChannelData: () => new Float32Array(16),
  }));
  return { FakeAudioContext, loadClip };
});

vi.mock("react-native-audio-api", () => ({ AudioContext: fake.FakeAudioContext }));
vi.mock("./audio-session", () => ({ preferPlaybackSession: () => undefined, probeAudioSession: async () => null }));
vi.mock("./builtin-voice-clips", () => ({
  speakers: [{ id: "adam", name: "Adam", voice: "male" }],
  voiceSpeeds: ["faster", "normal"],
  builtinVoiceClips: { faster: { adam: { verse: "verse.wav" } }, normal: { adam: { verse: "verse-normal.wav" } } },
}));
vi.mock("./load-clip", () => ({ loadClip: fake.loadClip }));
vi.mock("./hidden-lookahead", () => ({ HIDDEN_LOOKAHEAD_MS: 3_000 }));
vi.mock("./output-latency", () => ({ outputLatencyMs: () => 0 }));

const { CueAudioEngine } = await import("./engine");

const NOW = 1_000_000;
const SETUP_GAINS = 3;
const contexts = () => fake.FakeAudioContext.instances;

beforeEach(() => {
  vi.useFakeTimers();
  fake.FakeAudioContext.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("audio context younger than the output delay", () => {
  const song: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 8, beatsPerBar: 4, bpm: 120 }] };

  it("does not throw when joining mid-Song with a beat closer than the Latency nudge", async () => {
    const engine = new CueAudioEngine();
    engine.latencyNudgeMs = 200;
    engine.setPlan(song, { startsAt: NOW - 9_900, startSection: 0 });
    await engine.enable(() => NOW, null);
    expect(() => engine.setHidden(true)).not.toThrow();
    engine.dispose();
  });
});

describe("audio clock that stalls under the engine", () => {
  const song: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 8, beatsPerBar: 4, bpm: 120 }] };

  it("drops Clicks queued before an interruption instead of sounding them late once audio resumes", async () => {
    let now = NOW;
    const engine = new CueAudioEngine();
    await engine.enable(() => now, null);
    const [context] = contexts();
    engine.setPlan(song, { startsAt: NOW + 50, startSection: 0 });
    engine.setHidden(true);
    const queued = context.oscillatorNodes.length;
    expect(queued).toBeGreaterThan(0);

    context.state = "suspended";
    now += 10_000;
    expect(await engine.wake()).toBe(true);
    await vi.advanceTimersByTimeAsync(50);

    expect(context.oscillatorNodes.length).toBeGreaterThan(queued);
    const soundingLate = context.oscillatorNodes
      .slice(0, queued)
      .filter((oscillator, index) => (oscillator.startedAt ?? 0) > context.currentTime && !context.gains[SETUP_GAINS + index].disconnected);
    expect(soundingLate).toHaveLength(0);
    engine.dispose();
  });
});

describe("clock estimate that steps back", () => {
  const long: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 100, beatsPerBar: 4, bpm: 120 }] };

  it("keeps playing Clicks after a wrong estimate one minute ahead is corrected", async () => {
    let now = NOW + 60_000;
    const engine = new CueAudioEngine();
    await engine.enable(() => now, null);
    const [context] = contexts();
    engine.setPlan(long, { startsAt: NOW + 1_000, startSection: 0 });
    await vi.advanceTimersByTimeAsync(50);
    const whileWrong = context.oscillatorNodes.length;

    now = NOW;
    for (let step = 0; step < 120; step++) {
      now += 25;
      context.currentTime += 0.025;
      await vi.advanceTimersByTimeAsync(25);
    }

    expect(context.oscillatorNodes.length - whileWrong).toBeGreaterThanOrEqual(4);
    engine.dispose();
  });
});

describe("re-planning with a long output delay", () => {
  const verse: Song = { countIn: true, cueLeadBars: 1, sections: [{ sectionType: "Verse", bars: 4, beatsPerBar: 4, bpm: 60 }] };

  it("leaves a Voice cue that is already sounding alone when a Jump arrives", async () => {
    let now = NOW;
    const engine = new CueAudioEngine();
    engine.latencyNudgeMs = 300;
    const playback = { startsAt: NOW + 1_000, startSection: 0 };
    engine.setPlan(verse, playback);
    await engine.enable(() => now, "adam");
    const [context] = contexts();
    for (let step = 0; step < 30; step++) {
      now += 25;
      context.currentTime += 0.025;
      await vi.advanceTimersByTimeAsync(25);
    }
    expect(context.voiceStarts).toHaveLength(1);
    expect(context.voiceStarts[0]).toBeLessThan(context.currentTime);

    engine.setPlan(verse, { ...playback, jumps: [{ at: NOW + 9_000, toSection: 0 }] });
    now += 25;
    context.currentTime += 0.025;
    await vi.advanceTimersByTimeAsync(25);

    expect(context.sources[0].disconnected).toBe(false);
    expect(context.voiceStarts).toHaveLength(1);
    engine.dispose();
  });
});

describe("a Click that has already started", () => {
  const slow: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 8, beatsPerBar: 4, bpm: 60 }] };
  const firstBeatClicks = (context: InstanceType<typeof fake.FakeAudioContext>) =>
    context.oscillatorNodes.filter((oscillator) => oscillator.startedAt !== null && oscillator.startedAt > 0.5 && oscillator.startedAt < 1.2);

  it("is not sounded again when the clock estimate steps back a little while its beat is still ahead", async () => {
    let now = NOW;
    const engine = new CueAudioEngine();
    engine.latencyNudgeMs = 300;
    await engine.enable(() => now, null);
    const [context] = contexts();
    engine.setPlan(slow, { startsAt: NOW + 1_000, startSection: 0 });
    for (let step = 0; step < 30; step++) {
      now += 25;
      context.currentTime += 0.025;
      await vi.advanceTimersByTimeAsync(25);
    }
    expect(firstBeatClicks(context)).toHaveLength(1);

    now -= 100;
    for (let step = 0; step < 8; step++) {
      now += 25;
      context.currentTime += 0.025;
      await vi.advanceTimersByTimeAsync(25);
    }

    expect(firstBeatClicks(context)).toHaveLength(1);
    engine.dispose();
  });

  it("is not sounded again when the Latency nudge is cut after a trim kept it", async () => {
    let now = NOW;
    const engine = new CueAudioEngine();
    engine.latencyNudgeMs = 400;
    await engine.enable(() => now, null);
    const [context] = contexts();
    engine.setPlan(slow, { startsAt: NOW + 1_000, startSection: 0 });
    for (let step = 0; step < 25; step++) {
      now += 25;
      context.currentTime += 0.025;
      await vi.advanceTimersByTimeAsync(25);
    }
    expect(firstBeatClicks(context)).toHaveLength(1);

    engine.setHidden(true);
    engine.setHidden(false);
    engine.latencyNudgeMs = 0;
    for (let step = 0; step < 20; step++) {
      now += 25;
      context.currentTime += 0.025;
      await vi.advanceTimersByTimeAsync(25);
    }

    expect(firstBeatClicks(context)).toHaveLength(1);
    engine.dispose();
  });
});
