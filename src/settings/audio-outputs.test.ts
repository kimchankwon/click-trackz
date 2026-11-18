import { describe, expect, it } from "vitest";

import { MAX_REMEMBERED_OUTPUTS, parseRememberedOutputs, rememberOutput } from "./audio-outputs";

const DAY = 24 * 60 * 60_000;

describe("Remembered audio outputs", () => {
  it("reads nothing from a missing or broken value", () => {
    expect(parseRememberedOutputs(null)).toEqual([]);
    expect(parseRememberedOutputs("not json")).toEqual([]);
    expect(parseRememberedOutputs('{"id":"Speaker"}')).toEqual([]);
  });

  it("keeps only well formed entries", () => {
    const stored = JSON.stringify([
      { id: "Speaker", name: "Speaker", lastUsedAt: 5 },
      { id: "", name: "x", lastUsedAt: 1 },
      { id: "car", name: 3, lastUsedAt: 1 },
    ]);
    expect(parseRememberedOutputs(stored)).toEqual([{ id: "Speaker", name: "Speaker", lastUsedAt: 5 }]);
  });

  it("adds a new output first", () => {
    const known = [{ id: "Speaker", name: "iPhone Speaker", lastUsedAt: 10 }];
    expect(rememberOutput(known, { id: "airpods", name: "Sam's AirPods" }, 20)).toEqual([
      { id: "airpods", name: "Sam's AirPods", lastUsedAt: 20 },
      { id: "Speaker", name: "iPhone Speaker", lastUsedAt: 10 },
    ]);
  });

  it("writes nothing when an output was seen today under the same name", () => {
    const known = [{ id: "airpods", name: "Sam's AirPods", lastUsedAt: 10 }];
    expect(rememberOutput(known, { id: "airpods", name: "Sam's AirPods" }, 10 + DAY - 1)).toBeNull();
  });

  it("moves an output back to the top once a day or when it is renamed", () => {
    const known = [
      { id: "car", name: "Car", lastUsedAt: 50 },
      { id: "airpods", name: "Sam's AirPods", lastUsedAt: 10 },
    ];
    expect(rememberOutput(known, { id: "airpods", name: "Sam's AirPods" }, 10 + DAY)?.[0]).toEqual({ id: "airpods", name: "Sam's AirPods", lastUsedAt: 10 + DAY });
    expect(rememberOutput(known, { id: "airpods", name: "Pods" }, 60)?.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "airpods", name: "Pods" },
      { id: "car", name: "Car" },
    ]);
  });

  it("keeps an output reconnected today when a new one pushes the list past the limit", () => {
    const known = Array.from({ length: MAX_REMEMBERED_OUTPUTS }, (_, index) => ({ id: `out${index}`, name: `Out ${index}`, lastUsedAt: index }));
    const reconnected = rememberOutput(known, { id: "out0", name: "Out 0" }, MAX_REMEMBERED_OUTPUTS);
    expect(reconnected?.[0]).toEqual({ id: "out0", name: "Out 0", lastUsedAt: MAX_REMEMBERED_OUTPUTS });
    const next = rememberOutput(reconnected ?? known, { id: "new", name: "New" }, MAX_REMEMBERED_OUTPUTS + 1);
    expect(next?.map((entry) => entry.id).slice(0, 2)).toEqual(["new", "out0"]);
    expect(next?.some((entry) => entry.id === "out1")).toBe(false);
  });

  it("forgets the longest unused output past the limit", () => {
    const known = Array.from({ length: MAX_REMEMBERED_OUTPUTS }, (_, index) => ({
      id: `out${index}`,
      name: `Out ${index}`,
      lastUsedAt: 100 - index,
    }));
    const next = rememberOutput(known, { id: "new", name: "New" }, 200);
    expect(next).toHaveLength(MAX_REMEMBERED_OUTPUTS);
    expect(next?.[0].id).toBe("new");
    expect(next?.some((entry) => entry.id === `out${MAX_REMEMBERED_OUTPUTS - 1}`)).toBe(false);
  });
});
