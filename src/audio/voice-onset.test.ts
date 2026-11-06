import { describe, expect, it } from "vitest";

import { MAX_VOICE_LEAD_MS, perceivedOnsetMs } from "./voice-onset";

const RATE = 1_000;

function clip(parts: { ms: number; level: number }[]) {
  const samples = new Float32Array(parts.reduce((total, part) => total + part.ms, 0));
  let at = 0;
  for (const part of parts) {
    samples.fill(part.level, at, at + part.ms);
    at += part.ms;
  }
  return samples;
}

describe("perceivedOnsetMs", () => {
  it("finds where a word gets loud, not where its first faint sound starts", () => {
    const word = clip([
      { ms: 40, level: 0.05 },
      { ms: 200, level: 0.8 },
    ]);
    expect(perceivedOnsetMs(word, RATE)).toBe(40);
  });

  it("is zero for a clip that is loud from the start or silent", () => {
    expect(perceivedOnsetMs(clip([{ ms: 100, level: 0.5 }]), RATE)).toBe(0);
    expect(perceivedOnsetMs(clip([{ ms: 100, level: 0 }]), RATE)).toBe(0);
  });

  it("never moves a clip earlier than the cap", () => {
    const late = clip([
      { ms: 300, level: 0.01 },
      { ms: 100, level: 0.9 },
    ]);
    expect(perceivedOnsetMs(late, RATE)).toBe(MAX_VOICE_LEAD_MS);
  });
});
