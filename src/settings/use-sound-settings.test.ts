import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  type Cell = { value: unknown; deps?: readonly unknown[]; cleanup?: void | (() => void) };
  const state = {
    cells: [] as Cell[],
    cursor: 0,
    effects: [] as (() => void)[],
    dirty: false,
    viewer: undefined as unknown,
    saved: [] as Record<string, unknown>[],
  };
  const differs = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined) =>
    a === undefined || b === undefined || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
  const stateCell = (initial: unknown) => {
    const at = state.cursor++;
    if (state.cells[at] === undefined) state.cells[at] = { value: typeof initial === "function" ? (initial as () => unknown)() : initial };
    const set = (next: unknown) => {
      const cell = state.cells[at];
      const value = typeof next === "function" ? (next as (current: unknown) => unknown)(cell.value) : next;
      if (Object.is(value, cell.value)) return;
      cell.value = value;
      state.dirty = true;
    };
    return [state.cells[at].value, set];
  };
  const refCell = (initial: unknown) => {
    const at = state.cursor++;
    if (state.cells[at] === undefined) state.cells[at] = { value: { current: initial } };
    return state.cells[at].value;
  };
  const memoCell = (make: () => unknown, deps: readonly unknown[]) => {
    const at = state.cursor++;
    const cell = state.cells[at];
    if (cell === undefined || differs(cell.deps, deps)) state.cells[at] = { value: make(), deps };
    return state.cells[at].value;
  };
  const callbackCell = (callback: unknown, deps: readonly unknown[]) => memoCell(() => callback, deps);
  const effectCell = (run: () => void | (() => void), deps?: readonly unknown[]) => {
    const at = state.cursor++;
    const cell = state.cells[at];
    if (cell !== undefined && !differs(cell.deps, deps)) return;
    const next: Cell = { value: undefined, deps, cleanup: cell?.cleanup };
    state.cells[at] = next;
    state.effects.push(() => {
      if (typeof next.cleanup === "function") next.cleanup();
      next.cleanup = run();
    });
  };
  const save = (args: { sound: Record<string, unknown> }) => {
    state.saved.push(args.sound);
    return Promise.resolve(null);
  };
  const mutation = Object.assign(() => Promise.resolve(null), { withOptimisticUpdate: () => save });
  return { state, mutation, react: { useState: stateCell, useRef: refCell, useMemo: memoCell, useCallback: callbackCell, useEffect: effectCell } };
});

vi.mock("react", () => harness.react);
vi.mock("convex/react", () => ({ useQuery: () => harness.state.viewer, useMutation: () => harness.mutation }));
vi.mock("./use-device-setting", () => ({ useDeviceSetting: (_key: string, fallback: string) => [fallback] }));
vi.mock("@/audio/voice-clips", () => ({
  defaultSpeaker: "adam",
  defaultVoiceSpeed: "faster",
  isSpeakerId: (value: string) => value === "adam" || value === "alice",
  isVoiceSpeed: (value: string) => value === "normal" || value === "faster",
}));

const { useSoundSettings: soundSettingsHook } = await import("./use-sound-settings");

function render() {
  let result = soundSettingsHook();
  for (;;) {
    const effects = harness.state.effects;
    harness.state.effects = [];
    effects.forEach((run) => run());
    if (!harness.state.dirty) return result;
    harness.state.dirty = false;
    harness.state.cursor = 0;
    result = soundSettingsHook();
  }
}

function rerender() {
  harness.state.dirty = false;
  harness.state.cursor = 0;
  return render();
}

const savedProfile = { clickVolume: 0.3, voiceVolume: 0.2, speaker: "alice", voiceSpeed: "normal", click: true, voiceCues: true, spokenCounts: true };

beforeEach(() => {
  harness.state.cells = [];
  harness.state.cursor = 0;
  harness.state.effects = [];
  harness.state.dirty = false;
  harness.state.viewer = undefined;
  harness.state.saved = [];
});

describe("useSoundSettings before the profile has loaded", () => {
  it("does not replace the saved Speaker and volumes when one switch is changed before the profile arrives", async () => {
    const first = render();
    first.update({ spokenCounts: false });
    rerender();
    expect(harness.state.saved).toEqual([]);

    harness.state.viewer = { id: "user", isAnonymous: false, accent: null, sound: savedProfile };
    rerender();
    await Promise.resolve();

    for (const sound of harness.state.saved) {
      expect(sound).toMatchObject({ speaker: "alice", voiceSpeed: "normal", clickVolume: 0.3, voiceVolume: 0.2 });
    }
  });
});
