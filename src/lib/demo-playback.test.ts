import { describe, expect, it } from "vitest";

import { DEMO_START, demoCommand, demoFrameAt, demoJump, demoStart, demoStepSong, demoStop, nextDemoChangeAt } from "./demo-playback";

const BEAT = 500;

describe("the About page's demo Playback", () => {
  it("starts after the one-second Lead-in and counts like Play", () => {
    const started = demoStart(DEMO_START, 0);
    expect(demoFrameAt(started, 500).status).toBe("starting");
    expect(demoFrameAt(started, 1_000).beat?.count).toBe("INTRO");
    expect(demoFrameAt(started, 1_000 + BEAT).beat?.count).toBe("2");
    expect(demoFrameAt(started, 1_000 + 4 * BEAT).beat?.count).toBe("2");
  });

  it("jumps to another Section on a bar line at least a second away", () => {
    const started = demoStart(DEMO_START, 0);
    const jumped = demoJump(started, 2, 1_100);
    const frame = demoFrameAt(jumped, 1_200);
    expect(frame.jumpingTo).toBe(2);
    expect(demoFrameAt(jumped, 3_000).beat?.count).toBe("CHORUS1");
    expect(demoFrameAt(jumped, 3_000).sectionIndex).toBe(2);
  });

  it("stops a second after Stop is pressed", () => {
    const stopping = demoStop(demoStart(DEMO_START, 0), 2_000);
    expect(demoFrameAt(stopping, 2_500).status).toBe("stopping");
    expect(demoFrameAt(stopping, 3_000).status).toBe("idle");
  });

  it("only changes Song while stopped", () => {
    expect(demoStepSong(DEMO_START, 1, 0).songIndex).toBe(1);
    expect(demoStepSong(DEMO_START, -1, 0).songIndex).toBe(0);
    expect(demoStepSong(demoStart(DEMO_START, 0), 1, 500).songIndex).toBe(0);
  });

  it("answers Control Center commands the way the app does", () => {
    const playing = demoCommand(DEMO_START, "play", 0);
    expect(demoFrameAt(playing, 1_000).status).toBe("playing");
    expect(demoFrameAt(demoCommand(playing, "nextTrack", 1_100), 1_200).jumpingTo).toBe(1);
    expect(demoFrameAt(demoCommand(playing, "pause", 2_000), 3_000).status).toBe("idle");
    expect(demoCommand(DEMO_START, "nextTrack", 0).songIndex).toBe(1);
  });

  it("wakes on the next beat while live and sleeps while idle", () => {
    const started = demoStart(DEMO_START, 0);
    expect(nextDemoChangeAt(started, 200)).toBe(1_000);
    expect(nextDemoChangeAt(started, 1_100)).toBe(1_500);
    expect(nextDemoChangeAt(DEMO_START, 0)).toBeNull();
  });
});
