import { matchesGlob } from "node:path";

import type { CropEntry, MaskEntry } from "./mask.mts";
import type { Rect } from "./png.mts";

export type FlowEntry = { id: string; screen: string; mask?: MaskEntry[]; iosMaskRegions?: Rect[]; iosCrop?: CropEntry };
export type CoreRule = { rule: string; globs: string[] };
export type Area = { area: string; globs: string[]; flows: string[]; note?: string };
export type FeatureMap = { flows: FlowEntry[]; smoke: string; static: string[]; core: CoreRule[]; areas: Area[] };

export type Tier = "static" | "localized" | "full";
export type Reason = { file: string; rule: string };
export type Plan =
  { kind: "unmapped"; unmapped: string[] } | { kind: "run"; tier: Tier; reasons: Reason[]; flows: string[]; notes: string[]; unmapped: string[] };

export type PlanInput = { changed: string[]; map: FeatureMap; full: boolean; only: string[]; unattended: boolean };

const matchesAny = (file: string, globs: string[]) => globs.some((glob) => matchesGlob(file, glob));

type Classified = { kind: "core"; rule: string } | { kind: "static" } | { kind: "areas"; areas: Area[] } | { kind: "unmapped" };

export function classify(file: string, map: FeatureMap): Classified {
  const core = map.core.find((rule) => matchesAny(file, rule.globs));
  if (core) return { kind: "core", rule: core.rule };
  if (matchesAny(file, map.static)) return { kind: "static" };
  const areas = map.areas.filter((area) => matchesAny(file, area.globs));
  if (areas.length > 0) return { kind: "areas", areas };
  return { kind: "unmapped" };
}

const inCatalogOrder = (map: FeatureMap, ids: Set<string>) => map.flows.map((flow) => flow.id).filter((id) => ids.has(id));

const withSmoke = (map: FeatureMap, ids: Set<string>) => (ids.size > 0 ? new Set([map.smoke, ...ids]) : ids);

export function planFor({ changed, map, full, only, unattended }: PlanInput): Plan {
  const unknownFlow = only.find((id) => !map.flows.some((flow) => flow.id === id));
  if (unknownFlow) throw new Error(`Unknown flow "${unknownFlow}". Flows: ${map.flows.map((flow) => flow.id).join(", ")}`);
  if (only.length > 0) {
    return {
      kind: "run",
      tier: "localized",
      reasons: [{ file: "(none)", rule: `--only ${only.join(" ")}` }],
      flows: inCatalogOrder(map, withSmoke(map, new Set(only))),
      notes: [],
      unmapped: [],
    };
  }

  const reasons: Reason[] = [];
  const notes = new Set<string>();
  const flows = new Set<string>();
  const unmapped: string[] = [];
  let tier: Tier = "static";
  for (const file of changed) {
    const found = classify(file, map);
    if (found.kind === "core") {
      reasons.push({ file, rule: `core: ${found.rule}` });
      tier = "full";
    } else if (found.kind === "static") {
      reasons.push({ file, rule: "static" });
    } else if (found.kind === "areas") {
      reasons.push({ file, rule: `area: ${found.areas.map((area) => area.area).join(", ")}` });
      if (tier === "static") tier = "localized";
      for (const area of found.areas) {
        for (const flow of area.flows) flows.add(flow);
        if (area.note) notes.add(area.note);
      }
    } else {
      unmapped.push(file);
    }
  }

  if (unmapped.length > 0 && !unattended) return { kind: "unmapped", unmapped };
  for (const file of unmapped) reasons.push({ file, rule: "unmapped, unattended run falls back to full" });
  if (unmapped.length > 0) tier = "full";
  if (full) {
    reasons.unshift({ file: "(none)", rule: "--full" });
    tier = "full";
  }
  const selected = tier === "full" ? new Set(map.flows.map((flow) => flow.id)) : withSmoke(map, flows);
  return { kind: "run", tier, reasons, flows: inCatalogOrder(map, selected), notes: [...notes], unmapped };
}
