import { describe, expect, it } from "vitest";

import { LATENCY_NUDGE_KEY, latencyNudgeKeyFor, outputNudge } from "./latency";

const storeOf = (entries: Record<string, string>) => (key: string) => entries[key] ?? null;

describe("Latency nudge per audio output", () => {
  it("keeps the device-wide key when the output is unknown", () => {
    expect(latencyNudgeKeyFor(null)).toBe(LATENCY_NUDGE_KEY);
  });

  it("gives each output its own key that the device store accepts", () => {
    expect(latencyNudgeKeyFor("Speaker")).toBe("latencyNudgeMs.Speaker");
    expect(latencyNudgeKeyFor("40:4E:36:12:AB:CD-tacl")).toBe("latencyNudgeMs.40_3a_4E_3a_36_3a_12_3a_AB_3a_CD-tacl");
    expect(latencyNudgeKeyFor("Wired Headphones")).toBe("latencyNudgeMs.Wired_20_Headphones");
  });

  it("gives outputs whose ids differ only in characters the store does not allow different keys", () => {
    const ids = ["a:b", "a_b", "a b", "a_3a_b", "a🔊b"];
    const keys = ids.map(latencyNudgeKeyFor);
    expect(new Set(keys).size).toBe(ids.length);
    keys.forEach((key) => expect(key).toMatch(/^[A-Za-z0-9._-]+$/));
  });

  it("uses the nudge saved for the output playing now", () => {
    const read = storeOf({ [LATENCY_NUDGE_KEY]: "30", "latencyNudgeMs.Speaker": "0", "latencyNudgeMs.AirPods": "180" });
    expect(outputNudge("AirPods", read)).toEqual({ nudgeMs: 180, savedForOutput: true });
    expect(outputNudge("Speaker", read)).toEqual({ nudgeMs: 0, savedForOutput: true });
  });

  it("falls back to the device-wide nudge for an output with none saved yet", () => {
    const read = storeOf({ [LATENCY_NUDGE_KEY]: "150" });
    expect(outputNudge("Car", read)).toEqual({ nudgeMs: 150, savedForOutput: false });
  });

  it("uses the device-wide nudge when the output is unknown, as on the web", () => {
    expect(outputNudge(null, storeOf({ [LATENCY_NUDGE_KEY]: "-20" }))).toEqual({ nudgeMs: -20, savedForOutput: false });
    expect(outputNudge(null, storeOf({}))).toEqual({ nudgeMs: 0, savedForOutput: false });
  });

  it("ignores a stored value outside the nudge range", () => {
    const read = storeOf({ [LATENCY_NUDGE_KEY]: "40", "latencyNudgeMs.AirPods": "9000" });
    expect(outputNudge("AirPods", read)).toEqual({ nudgeMs: 40, savedForOutput: false });
  });
});
