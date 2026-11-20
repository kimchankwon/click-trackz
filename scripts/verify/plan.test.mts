import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { planFor, type FeatureMap } from "./plan.mts";

const map = JSON.parse(readFileSync(path.join(import.meta.dirname, "feature-map.json"), "utf8")) as FeatureMap;
const allFlows = map.flows.map((flow) => flow.id);
const plan = (changed: string[], options: Partial<{ full: boolean; only: string[]; unattended: boolean }> = {}) =>
  planFor({ changed, map, full: false, only: [], unattended: false, ...options });

describe("planFor", () => {
  it("runs checks only when every file is static", () => {
    expect(plan(["README.md", "docs/adr/0001-sync-the-schedule-not-the-beats.md", ".github/workflows/ci.yml"])).toMatchObject({
      kind: "run",
      tier: "static",
      flows: [],
    });
  });

  it("runs checks only for an empty diff", () => {
    expect(plan([])).toMatchObject({ kind: "run", tier: "static", flows: [] });
  });

  it("runs the smoke flow plus the mapped flows for a localized change", () => {
    const result = plan(["src/components/group/songs-card.tsx", "src/components/sound/sound-settings.tsx"]);
    expect(result).toMatchObject({ kind: "run", tier: "localized", flows: ["smoke", "group", "sound-settings"] });
  });

  it("matches routes with bracketed segments", () => {
    expect(plan(["src/app/group/[groupId]/song/[songId].tsx"])).toMatchObject({ tier: "localized", flows: ["smoke", "song"] });
  });

  it("runs the setlist and join flows for their routes", () => {
    expect(plan(["src/app/group/[groupId]/setlist/[setlistId].tsx"])).toMatchObject({ tier: "localized", flows: ["smoke", "setlist"] });
    expect(plan(["src/app/join/[code].tsx"])).toMatchObject({ tier: "localized", flows: ["smoke", "join"] });
  });

  it("escalates to every flow when a core file changes, and names the rule", () => {
    const result = plan(["src/components/group/songs-card.tsx", "src/app/group/[groupId]/_layout.tsx"]);
    expect(result).toMatchObject({ kind: "run", tier: "full", flows: allFlows });
    if (result.kind !== "run") throw new Error("expected a run");
    expect(result.reasons).toContainEqual({ file: "src/app/group/[groupId]/_layout.tsx", rule: "core: Navigation" });
  });

  it("treats the verify harness itself as core", () => {
    expect(plan(["scripts/verify/feature-map.json"])).toMatchObject({ tier: "full" });
  });

  it("stops before running anything when a file is unmapped", () => {
    expect(plan(["src/brand-new/thing.ts", "README.md"])).toEqual({ kind: "unmapped", unmapped: ["src/brand-new/thing.ts"] });
  });

  it("still stops on unmapped files under --full when attended", () => {
    expect(plan(["src/brand-new/thing.ts"], { full: true })).toEqual({ kind: "unmapped", unmapped: ["src/brand-new/thing.ts"] });
  });

  it("falls back to the full tier and reports unmapped files when unattended", () => {
    const result = plan(["src/brand-new/thing.ts", "README.md"], { unattended: true });
    expect(result).toMatchObject({ kind: "run", tier: "full", flows: allFlows, unmapped: ["src/brand-new/thing.ts"] });
  });

  it("says plainly that billing is unit tests only and launches no app for it", () => {
    const result = plan(["src/billing/purchases.ts", "convex/revenuecat.ts"]);
    expect(result).toMatchObject({ kind: "run", tier: "localized", flows: [] });
    if (result.kind !== "run") throw new Error("expected a run");
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatch(/unit tests only/);
  });

  it("runs every flow for --full", () => {
    expect(plan(["README.md"], { full: true })).toMatchObject({ tier: "full", flows: allFlows });
  });

  it("runs the named flows plus smoke for --only, in catalog order", () => {
    expect(plan([], { only: ["song", "about"] })).toMatchObject({ kind: "run", flows: ["smoke", "about", "song"] });
  });

  it("rejects an unknown --only flow", () => {
    expect(() => plan([], { only: ["nope"] })).toThrow(/Unknown flow "nope"/);
  });

  it("maps every flow an area names to a catalog entry", () => {
    const named = map.areas.flatMap((area) => area.flows);
    expect(named.filter((id) => !allFlows.includes(id))).toEqual([]);
  });
});
