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
    connect() {
      return this;
    }
  }
  class FakeGain extends FakeNode {
    gain = new FakeParam();
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
    createOscillator() {
      this.oscillators += 1;
      return new FakeOscillator();
    }
    played: FakeBuffer[] = [];
    createBufferSource() {
      const played = this.played;
      const source = {
        buffer: null as FakeBuffer | null,
        connect() {
          return source;
        },
        start() {
          if (source.buffer) played.push(source.buffer);
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
const serverNow = () => NOW;
const contexts = () => fake.FakeAudioContext.instances;
const CHORUS = "https://example.com/chorus.wav";
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

  it("reloads recordings when the new context runs at a different sample rate", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    await engine.setUploads([{ key: "chorus", url: CHORUS }]);
    expect(loadsOf(CHORUS)).toBe(1);

    fake.FakeAudioContext.sampleRates.push(44_100);
    await engine.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(loadsOf(CHORUS)).toBe(2);
    engine.dispose();
  });

  it("keeps decoded recordings when the sample rate is unchanged", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    await engine.setUploads([{ key: "chorus", url: CHORUS }]);
    await engine.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(loadsOf(CHORUS)).toBe(1);
    engine.dispose();
  });

  it("drops a recording decoded at the old sample rate that finishes after the reload", async () => {
    const engine = new CueAudioEngine();
    await startStuck(engine);
    const finishOldLoad = holdNextLoad();
    const loadingOld = engine.setUploads([{ key: "chorus", url: CHORUS }]);

    fake.FakeAudioContext.sampleRates.push(44_100);
    await engine.wake();
    await vi.advanceTimersByTimeAsync(0);
    finishOldLoad(48_000);
    await loadingOld;

    engine.previewUpload("chorus");
    expect(contexts()[1].played.map((buffer) => buffer.sampleRate)).toEqual([44_100]);
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
