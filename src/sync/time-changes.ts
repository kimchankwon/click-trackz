import { BEAT_UNITS, MAX_TIME_CHANGES, type Section, type TimeChange } from "./timeline";

type ChangeableSection = Pick<Section, "bars" | "beatsPerBar" | "beatUnit" | "timeChanges">;

const wholeBetween = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

export const byBar = (changes: readonly TimeChange[]) => [...changes].sort((a, b) => a.bar - b.bar);

export function timeChangesProblem(section: ChangeableSection): string | null {
  const changes = section.timeChanges ?? [];
  if (changes.length > MAX_TIME_CHANGES) return `A Section can have at most ${MAX_TIME_CHANGES} time changes`;
  let firstFreeBar = 1;
  for (const change of byBar(changes)) {
    const where = `The time change at bar ${change.bar}`;
    if (!wholeBetween(change.bar, 1, section.bars)) return `A time change must start on a bar from 1 to ${section.bars}`;
    if (!Number.isInteger(change.bars) || change.bars < 1) return `${where} needs a whole number of bars`;
    if (change.bar + change.bars - 1 > section.bars) return `${where} runs past the end of the Section`;
    if (change.bar < firstFreeBar) return `${where} overlaps the one before it`;
    if (!wholeBetween(change.beatsPerBar, 1, 12)) return `${where} needs 1 to 12 beats per bar`;
    if (!BEAT_UNITS.some((unit) => unit === change.beatUnit)) return `${where} must count halves, quarters, eighths or sixteenths`;
    firstFreeBar = change.bar + change.bars;
  }
  return null;
}

export function newTimeChange(section: ChangeableSection): TimeChange | null {
  const changes = section.timeChanges ?? [];
  if (section.bars < 2 || changes.length >= MAX_TIME_CHANGES) return null;
  const free = (bar: number) => bar <= section.bars && !changes.some((change) => bar >= change.bar && bar < change.bar + change.bars);
  const ends = changes.map((change) => change.bar + change.bars);
  const afterLastChange = Math.max(1, ...ends);
  const bar = [afterLastChange, ...[1, ...ends].sort((a, b) => a - b)].find(free);
  return bar === undefined ? null : { bar, bars: 1, beatsPerBar: section.beatsPerBar === 2 ? 3 : 2, beatUnit: section.beatUnit ?? 4 };
}

export type MeterRun = { bars: number; beatsPerBar: number; beatUnit?: number };

export function meterRunsOf(section: ChangeableSection): MeterRun[] {
  const changes = section.timeChanges ?? [];
  const changedBars = changes.reduce((total, change) => total + change.bars, 0);
  return [
    { bars: Math.max(0, section.bars - changedBars), beatsPerBar: section.beatsPerBar, beatUnit: section.beatUnit },
    ...changes.map((change) => ({ bars: change.bars, beatsPerBar: change.beatsPerBar, beatUnit: change.beatUnit })),
  ];
}
