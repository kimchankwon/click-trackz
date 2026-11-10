import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LockScreenInfo } from "@/lib/lock-screen";

const native = vi.hoisted(() => ({
  calls: [] as string[],
  shown: [] as Record<string, unknown>[],
  hold: null as Promise<void> | null,
}));

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("./now-playing-artwork", () => ({ nowPlayingArtwork: 1 }));
vi.mock("./headset-play-pause", () => ({ setHeadsetPlayPause: () => native.calls.push("headset"), onHeadsetPlayPause: () => () => undefined }));
vi.mock("expo-asset", () => ({ Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: "file:///app/now-playing.png", uri: "" }) }) } }));
vi.mock("react-native-audio-api", () => ({
  PlaybackNotificationManager: {
    enableControl: async (control: string, enabled: boolean) => {
      native.calls.push(`${control}:${enabled}`);
      if (native.hold) await native.hold;
    },
    show: async (info: Record<string, unknown>) => {
      native.calls.push("show");
      native.shown.push(info);
    },
    hide: async () => undefined,
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

const playing: LockScreenInfo = { title: "You Alone", artist: "Verse", album: "First Setlist", duration: 60, elapsedTime: 10, speed: 1 };
const adminControls = { play: true, pause: true, stop: true, nextTrack: true, previousTrack: true, togglePlayPause: true };

async function freshModule() {
  vi.resetModules();
  return import("./now-playing");
}

beforeEach(() => {
  native.calls = [];
  native.shown = [];
  native.hold = null;
  vi.useFakeTimers({ toFake: ["performance", "setTimeout"] });
});

afterEach(() => vi.useRealTimers());

describe("Now Playing native calls", () => {
  it("skips controls that are already set, so react-native-audio-api does not re-post stale time", async () => {
    const { setLockScreenControls } = await freshModule();
    await setLockScreenControls(adminControls);
    expect(native.calls.filter((call) => call !== "headset")).toEqual([
      "skipForward:false",
      "skipBackward:false",
      "seekTo:false",
      "play:true",
      "pause:true",
      "stop:true",
      "nextTrack:true",
      "previousTrack:true",
    ]);
    native.calls = [];
    await setLockScreenControls(adminControls);
    expect(native.calls.filter((call) => call !== "headset")).toEqual([]);
    await setLockScreenControls({ ...adminControls, nextTrack: false, previousTrack: false });
    expect(native.calls.filter((call) => call !== "headset")).toEqual(["nextTrack:false", "previousTrack:false"]);
  });

  it("sends fresh info only after a control change has gone through, with the time moved on by the wait", async () => {
    const { setLockScreenControls, showOnLockScreen } = await freshModule();
    let release: () => void = () => undefined;
    native.hold = new Promise((done) => (release = done));
    const controls = setLockScreenControls(adminControls);
    const shown = showOnLockScreen(playing);
    await vi.advanceTimersByTimeAsync(500);
    expect(native.calls).not.toContain("show");
    native.hold = null;
    release();
    await controls;
    await shown;
    expect(native.calls.at(-1)).toBe("show");
    expect(native.shown.at(-1)).toMatchObject({ elapsedTime: 10.5, artwork: "/app/now-playing.png", state: "playing" });
  });

  it("never moves the time past the end of the Song, or at all while it stands still", async () => {
    const { setLockScreenControls, showOnLockScreen } = await freshModule();
    let release: () => void = () => undefined;
    native.hold = new Promise((done) => (release = done));
    const controls = setLockScreenControls(adminControls);
    const nearEnd = showOnLockScreen({ ...playing, elapsedTime: 59.8 });
    const still = showOnLockScreen({ ...playing, speed: 0 });
    await vi.advanceTimersByTimeAsync(500);
    native.hold = null;
    release();
    await Promise.all([controls, nearEnd, still]);
    expect(native.shown.map((info) => info.elapsedTime)).toEqual([60, 10]);
  });
});
