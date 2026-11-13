import { useSyncExternalStore } from "react";

import { DEMO_START, demoCommand, demoFrameAt, demoJump, demoStart, demoStepSong, demoStop, nextDemoChangeAt, type DemoFrame, type DemoState } from "@/lib/demo-playback";
import type { LockScreenCommand } from "@/lib/lock-screen";

const listeners = new Set<() => void>();
const now = () => performance.now();
let state: DemoState = DEMO_START;
let frame: DemoFrame = demoFrameAt(state, now());
let timer: ReturnType<typeof setTimeout> | null = null;
let autoStarted = false;

function schedule() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  if (listeners.size === 0) return;
  const at = nextDemoChangeAt(state, now());
  if (at === null) return;
  timer = setTimeout(refresh, Math.max(0, at - now()) + 1);
}

function refresh() {
  frame = demoFrameAt(state, now());
  listeners.forEach((listener) => listener());
  schedule();
}

function update(next: (current: DemoState, nowMs: number) => DemoState) {
  state = next(state, now());
  refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!autoStarted) {
    autoStarted = true;
    update((current, nowMs) => demoStart(current, nowMs));
  } else schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

export const demoActions = {
  start: (fromSection?: number) => update((current, nowMs) => demoStart(current, nowMs, fromSection)),
  stop: () => update(demoStop),
  jump: (toSection: number) => update((current, nowMs) => demoJump(current, toSection, nowMs)),
  stepSong: (step: -1 | 1) => update((current, nowMs) => demoStepSong(current, step, nowMs)),
  command: (command: LockScreenCommand) => update((current, nowMs) => demoCommand(current, command, nowMs)),
};

export const useDemoPlayback = (): DemoFrame => useSyncExternalStore(subscribe, () => frame, () => frame);
