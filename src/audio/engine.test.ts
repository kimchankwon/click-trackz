import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Song } from "@/sync/timeline";

const fake = vi.hoisted(() => {
  class FakeParam {
    value = 1;
    setValueAtTime() {
      return this;
    }
    exponentialRampToValueAtTime() {
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
    start() {}
    stop() {}
  }
  class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    static resumeModes: ("run" | "hang")[] = [];
    static sampleRates: number[] = [];
    state = "suspended";
    currentTime = 0;
    sampleRate = FakeAudioContext.sampleRates.shift() ?? 48_000;
    destination = new FakeNode();
    gains: FakeGain[] = [];
    oscillators = 0;
    mode = FakeAudioContext.resumeModes.shift() ?? "run";
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
    shapers: FakeShaper[] = [];
    createWaveShaper() {
      const shaper = new FakeShaper();
      this.shapers.push(shaper);
      return shaper;
    }
    createOscillator() {
      this.oscillators += 1;
      return new FakeOscillator();
    }
    played: FakeBuffer[] = [];
    voiceStarts: number[] = [];
    sources: { disconnected: boolean }[] = [];
    createBufferSource() {
      const played = this.played;
      const voiceStarts = this.voiceStarts;
      const sources = this.sources;
      const source = {
        buffer: null as FakeBuffer | null,
        connect() {
          return source;
        },
        disconnected: false,
        disconnect() {
          source.disconnected = true;
          return undefined;
        },
        start(when: number) {
          if (source.buffer) played.push(source.buffer);
          voiceStarts.push(when);
          sources.push(source);
        },
      };
      return source;
    }
    resume() {
      if (this.mode === "hang") return new Promise<void>(() => undefined);
      return Promise.resolve().then(() => {
        if (this.state !== "closed") this.state = "running";
      });
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
  }
  const fakeBuffer = (sampleRate: number, source: unknown) => ({
    duration: 0.5,
    sampleRate,
    source,
    getChannelData: () => new Float32Array(16),
  });
  type FakeBuffer = ReturnType<typeof fakeBuffer>;
  const loadClip = vi.fn(async (context: { sampleRate: number }, source: unknown) => fakeBuffer(context.sampleRate, source));
  return { FakeAudioContext, loadClip, fakeBuffer };
});

vi.mock("react-native-audio-api", () => ({ AudioContext: fake.FakeAudioContext }));
vi.mock("./audio-session", () => ({ preferPlaybackSession: () => undefined, probeAudioSession: async () => null }));
vi.mock("./builtin-voice-clips", () => ({ speakers: [{ id: "adam", name: "Adam" }], builtinVoiceClips: { adam: { verse: "verse.wav" } } }));
vi.mock("./load-clip", () => ({ loadClip: fake.loadClip }));

const { CueAudioEngine } = await import("./engine");

const song: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 8, beatsPerBar: 4, bpm: 120 }] };
const NOW = 1_000_000;
const SETUP_GAINS = 3;
const serverNow = () => NOW;
const contexts = () => fake.FakeAudioContext.instances;
const VERSE = "verse.wav";
const loadsOf = (source: unknown) => fake.loadClip.mock.calls.filter(([, loaded]) => loaded === source).length;

async function startStuck(engine: InstanceType<typeof CueAudioEngine>) {
  fake.FakeAudioContext.resumeModes.push("hang");
  const started = engine.enable(serverNow, null);
  await vi.advanceTimersByTimeAsync(1_000);
  return started;
}

function holdNextLoad() {
  let finish: (sampleRate: number) => void = () => undefined;
  fake.loadClip.mockImplementationOnce(
    (_context, source) =>
      new Promise((done) => {
        finish = (sampleRate) => done(fake.fakeBuffer(sampleRate, source));
      }),
  );
  return (sampleRate: number) => finish(sampleRate);
}

beforeEach(() => {
  vi.useFakeTimers();
  fake.FakeAudioContext.instances = [];
  fake.FakeAudioContext.resumeModes = [];
  fake.FakeAudioContext.sampleRates = [];
  fake.loadClip.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Subdivision", () => {
  const bar: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 1, beatsPerBar: 4, bpm: 60 }] };

  it("adds the softer Clicks between beats when the Song asks for them", async () => {
    const clicksFor = async (plan: Song) => {
      const engine = new CueAudioEngine();
      engine.setPlan(plan, { startsAt: NOW + 50, startSection: 0 });
      await engine.enable(serverNow, null);
      engine.setHidden(true);
      const count = contexts().at(-1)!.oscillators;
      engine.dispose();
      return count;
    };
    expect(await clicksFor(bar)).toBe(4);
    expect(await clicksFor({ ...bar, subdivision: 2 })).toBe(8);
    expect(await clicksFor({ ...bar, subdivision: 4 })).toBe(16);
  });

  it("plays the softer Clicks still ahead in a beat that began before this device joined, and drops them on Mute", async () => {
    let now = NOW;
    const engine = new CueAudioEngine();
    const playback = { startsAt: NOW - 100, startSection: 0 };
    engine.setPlan({ ...bar, subdivision: 4 }, playback);
    await engine.enable(() => now, null);
    engine.setHidden(true);
    const context = contexts().at(-1)!;
    expect(context.oscillators).toBe(15);
    now = NOW + 500;
    engine.setPlan({ ...bar, subdivision: 4 }, null);
    expect(context.gains.filter((gain) => gain.disconnected)).toHaveLength(13);
    engine.dispose();
  });

  it("still plays the last softer Click of a Time change beat longer than the old two-second lookback", async () => {
    const halfNotes: Song = {
      countIn: false,
      subdivision: 4,
      sections: [{ sectionType: "Verse", bars: 2, beatsPerBar: 4, bpm: 30, timeChanges: [{ bar: 1, bars: 1, beatsPerBar: 2, beatUnit: 2 }] }],
    };
    const engine = new CueAudioEngine();
    engine.setPlan(halfNotes, { startsAt: NOW - 2_500, startSection: 0 });
    await engine.enable(serverNow, null);
    engine.setHidden(true);
    expect(contexts().at(-1)!.oscillators).toBe(1 + 4 + 16);
    engine.dispose();
  });
});

describe("Voice cue offset", () => {
  it("moves the Voice cue sooner or later on this device without moving the Click", async () => {
    const verse: Song = { countIn: true, cueLeadBars: 1, sections: [{ sectionType: "Verse", bars: 1, beatsPerBar: 4, bpm: 60 }] };
    const playFor = async (offsetMs: number) => {
      const engine = new CueAudioEngine();
      engine.voiceOffsetMs = offsetMs;
      engine.setPlan(verse, { startsAt: NOW + 300, startSection: 0 });
      await engine.enable(serverNow, null);
      await engine.setSpeaker("adam");
      engine.setHidden(true);
      const context = contexts().at(-1)!;
      const heard = { voice: [...context.voiceStarts], clicks: context.oscillators };
      engine.dispose();
      return heard;
    };
    const plain = await playFor(0);
    const later = await playFor(50);
    const sooner = await playFor(-50);
    expect(plain.voice).toHaveLength(1);
    expect(later.voice[0] - plain.voice[0]).toBeCloseTo(0.05);
    expect(plain.voice[0] - sooner.voice[0]).toBeCloseTo(0.05);
    expect([later.clicks, sooner.clicks]).toEqual([plain.clicks, plain.clicks]);
  });

  it("never lets a later Voice cue sound after a Stop that lands before the clip starts", async () => {
    const verse: Song = { countIn: true, cueLeadBars: 1, sections: [{ sectionType: "Verse", bars: 1, beatsPerBar: 4, bpm: 60 }] };
    const playback = { startsAt: NOW + 300, startSection: 0 };
    const known = new CueAudioEngine();
    known.voiceOffsetMs = 200;
    known.setPlan(verse, { ...playback, stopsAt: NOW + 400 });
    await known.enable(serverNow, null);
    await known.setSpeaker("adam");
    known.setHidden(true);
    expect(contexts().at(-1)!.voiceStarts).toEqual([]);
    known.dispose();

    const late = new CueAudioEngine();
    late.voiceOffsetMs = 200;
    late.setPlan(verse, playback);
    await late.enable(serverNow, null);
    await late.setSpeaker("adam");
    late.setHidden(true);
    const context = contexts().at(-1)!;
    expect(context.sources).toHaveLength(1);
    late.setPlan(verse, { ...playback, stopsAt: NOW + 400 });
    expect(context.sources[0].disconnected).toBe(true);
    late.dispose();
  });

  it("keeps a later Voice cue whose beat is already queued when the app comes back to the foreground", async () => {
    let now = NOW;
    const verse: Song = { countIn: true, cueLeadBars: 1, sections: [{ sectionType: "Verse", bars: 1, beatsPerBar: 4, bpm: 60 }] };
    const engine = new CueAudioEngine();
    engine.voiceOffsetMs = 200;
    engine.setPlan(verse, { startsAt: NOW + 100, startSection: 0 });
    await engine.enable(() => now, null);
    await engine.setSpeaker("adam");
    engine.setHidden(true);
    const context = contexts().at(-1)!;
    expect(context.sources).toHaveLength(1);
    now = NOW + 50;
    engine.setHidden(false);
    expect(context.sources[0].disconnected).toBe(false);
    engine.dispose();
  });
});

describe("Stereo split", () => {
  it("pans the Click and the Voice cues to their own sides, set before or after sound is on", async () => {
    const engine = new CueAudioEngine();
    expect(engine.panning).toEqual({ click: null, voice: null });
    engine.setSides({ click: "left", voice: "right" });
    await engine.enable(serverNow, null);
    expect(engine.panning).toEqual({ click: -1, voice: 1 });
    engine.setSides({ click: "both", voice: "left" });
    expect(engine.panning).toEqual({ click: 0, voice: -1 });
    engine.dispose();
  });
});

describe("Stop", () => {
  const bar: Song = { countIn: false, sections: [{ sectionType: "Verse", bars: 1, beatsPerBar: 4, bpm: 120 }] };

  it("never schedules a softer Click that falls at or after the Stop instant", async () => {
    const engine = new CueAudioEngine();
    engine.setPlan({ ...bar, subdivision: 2 }, { startsAt: NOW + 50, startSection: 0, stopsAt: NOW + 50 + 1_250 });
    await engine.enable(serverNow, null);
    engine.setHidden(true);
    expect(contexts().at(-1)!.oscillators).toBe(5);
    engine.dispose();
  });

  it("drops a queued Click once a Stop lands before it, even inside the lookahead", async () => {
    const engine = new CueAudioEngine();
    const playback = { startsAt: NOW + 50, startSection: 0 };
    engine.setPlan(bar, playback);
    await engine.enable(serverNow, null);
    await vi.advanceTimersByTimeAsync(50);
    const context = contexts().at(-1)!;
    expect(context.oscillators).toBeGreaterThan(0);
    engine.setPlan(bar, { ...playback, stopsAt: NOW + 40 });
    expect(context.gains.slice(SETUP_GAINS).every((gain) => gain.disconnected)).toBe(true);
    engine.dispose();
  });
});

describe("sound recovery", () => {
  it("asks for a fresh context after a resume that never finishes, then replaces it", async () => {
    const engine = new CueAudioEngine();
    expect(await startStuck(engine)).toBe(false);
    expect(engine.failure).toMatch(/still starting after/);
    expect(engine.debugSnapshot().needsFreshContext).toBe(true);

    expect(await engine.wake()).toBe(true);
    expect(contexts().map((context) => context.state)).toEqual(["closed", "running"]);
    expect(engine.failure).toBeNull();
    expect(engine.debugSnapshot().needsFreshContext).toBe(false);
    engine.dispose();
  });

  it("resumes a context that is only suspended instead of replacing it", async () => {
    const engine = new CueAudioEngine();
    expect(await engine.enable(serverNow, null)).toBe(true);
    contexts()[0].state = "suspended";
    expect(await engine.wake()).toBe(true);
    expect(contexts()).toHaveLength(1);
    engine.dispose();
  });

  it("shares one renewal between wake calls that arrive together", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    expect(await Promise.all([engine.wake(), engine.wake()])).toEqual([true, true]);
    expect(contexts()).toHaveLength(2);
    engine.dispose();
  });

  it("ignores a resume that settles after its context was replaced", async () => {
    const engine = new CueAudioEngine();
    fake.FakeAudioContext.resumeModes.push("hang");
    const started = engine.enable(serverNow, null);
    contexts()[0].state = "interrupted";
    expect(await engine.wake()).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await started).toBe(true);
    expect(engine.failure).toBeNull();
    expect(engine.debugSnapshot().needsFreshContext).toBe(false);
    engine.dispose();
  });

  it("keeps the volumes and the plan, and schedules beats on the new context only", async () => {
    const engine = new CueAudioEngine();
    engine.setVolumes({ click: 0.3, voice: 0.5 });
    engine.setPlan(song, { startsAt: NOW + 50, startSection: 0 });
    await startStuck(engine);
    await engine.wake();

    const [stuck, fresh] = contexts();
    expect(fresh.gains.slice(0, 2).map((gain) => gain.gain.value)).toEqual([0.3, 0.5]);
    await vi.advanceTimersByTimeAsync(100);
    expect(fresh.oscillators).toBeGreaterThan(0);
    expect(stuck.oscillators).toBe(0);
    engine.dispose();
  });

  it("reloads Speaker clips when the new context runs at a different sample rate", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    await engine.setSpeaker("adam");
    expect(loadsOf(VERSE)).toBe(1);

    fake.FakeAudioContext.sampleRates.push(44_100);
    await engine.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(loadsOf(VERSE)).toBe(2);
    engine.dispose();
  });

  it("keeps decoded Speaker clips when the sample rate is unchanged", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    await engine.setSpeaker("adam");
    await engine.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(loadsOf(VERSE)).toBe(1);
    engine.dispose();
  });

  it("drops voice clips decoded at the old sample rate that finish after the reload", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    const finishOldLoad = holdNextLoad();
    const loadingOld = engine.setSpeaker("adam");

    fake.FakeAudioContext.sampleRates.push(44_100);
    await engine.wake();
    await vi.advanceTimersByTimeAsync(0);
    finishOldLoad(48_000);
    await loadingOld;

    engine.preview("verse" as Parameters<typeof engine.preview>[0]);
    await vi.advanceTimersByTimeAsync(0);
    expect(contexts()[1].played.map((buffer) => buffer.sampleRate)).toEqual([44_100]);
    engine.dispose();
  });

  it("schedules the rest of the Song when the page is hidden, then drops it if the plan changes", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    await engine.wake();
    const playback = { startsAt: NOW + 50, startSection: 0 };
    engine.setPlan(song, playback);
    await vi.advanceTimersByTimeAsync(50);
    const [, context] = contexts();
    const visibleClicks = context.oscillators;
    expect(visibleClicks).toBeLessThan(4);

    engine.setHidden(true);
    expect(context.oscillators).toBe(32);

    engine.setPlan(song, { ...playback, jumps: [{ at: NOW + 4_050, toSection: 0 }] });
    const clickGains = context.gains.slice(SETUP_GAINS);
    expect(clickGains.filter((gain) => gain.disconnected).length).toBeGreaterThan(20);
    expect(clickGains.slice(0, visibleClicks).every((gain) => !gain.disconnected)).toBe(true);
    engine.dispose();
  });

  it("trims the long queue back to the normal lookahead when the page is visible again", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    await engine.wake();
    engine.setPlan(song, { startsAt: NOW + 50, startSection: 0 });
    await vi.advanceTimersByTimeAsync(50);
    const [, context] = contexts();
    const visibleClicks = context.oscillators;
    engine.setHidden(true);
    engine.setHidden(false);
    const clickGains = context.gains.slice(SETUP_GAINS);
    expect(clickGains.filter((gain) => !gain.disconnected).length).toBe(visibleClicks);
    engine.dispose();
  });

  it("drops the long queue when a Jump arrives while the clock is unavailable", async () => {
    let clock: number | null = NOW;
    const engine = new CueAudioEngine();
    fake.FakeAudioContext.resumeModes.push("hang");
    const started = engine.enable(() => clock, null);
    await vi.advanceTimersByTimeAsync(1_000);
    await started;
    await engine.wake();
    const playback = { startsAt: NOW + 50, startSection: 0 };
    engine.setPlan(song, playback);
    engine.setHidden(true);
    const [, context] = contexts();
    clock = null;
    engine.setPlan(song, { ...playback, jumps: [{ at: NOW + 4_050, toSection: 0 }] });
    expect(context.gains.slice(SETUP_GAINS).every((gain) => gain.disconnected)).toBe(true);
    engine.dispose();
  });

  it("leaves nothing open when disposed during recovery", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    fake.FakeAudioContext.resumeModes.push("hang");
    const waking = engine.wake();
    engine.dispose();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await waking).toBe(false);
    expect(contexts().every((context) => context.state === "closed")).toBe(true);
    expect(engine.enabled).toBe(false);
  });
});
