import { MAX_PLAYS, SECTION_LETTERS, type Section, type SectionLetter } from "@/sync/timeline";

export const MIN_BPM = 30;
export const MAX_BPM = 300;
export const MAX_SECTION_NUMBER = 9;

export const SONG_TEMPO = "song";
export const NO_CHOICE = "none";

type Option<T extends string> = { value: T; label: string };

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const LETTER_OPTIONS: readonly Option<SectionLetter | typeof NO_CHOICE>[] = [
  { value: NO_CHOICE, label: "None" },
  ...SECTION_LETTERS.map((letter) => ({ value: letter, label: letter })),
];

export const NUMBER_OPTIONS: readonly Option<string>[] = [
  { value: NO_CHOICE, label: "None" },
  ...range(1, MAX_SECTION_NUMBER).map((n) => ({ value: String(n), label: String(n) })),
];

export const PLAYS_OPTIONS: readonly Option<string>[] = range(1, MAX_PLAYS).map((n) => ({ value: String(n), label: `×${n}` }));

const COMMON_TIME_SIGNATURES: readonly (readonly [number, number])[] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 4],
  [7, 4],
  [2, 2],
  [3, 8],
  [5, 8],
  [6, 8],
  [7, 8],
  [9, 8],
  [12, 8],
];

export const timeKeyOf = (section: Pick<Section, "beatsPerBar" | "beatUnit">) => `${section.beatsPerBar}/${section.beatUnit ?? 4}`;

export function timeOptions(current: Pick<Section, "beatsPerBar" | "beatUnit">): Option<string>[] {
  const keys = COMMON_TIME_SIGNATURES.map(([beatsPerBar, beatUnit]) => timeKeyOf({ beatsPerBar, beatUnit }));
  const picked = timeKeyOf(current);
  return (keys.includes(picked) ? keys : [picked, ...keys]).map((key) => ({ value: key, label: key }));
}

export function timeOfKey(key: string): Pick<Section, "beatsPerBar" | "beatUnit"> {
  const [beatsPerBar, beatUnit] = key.split("/").map(Number);
  return { beatsPerBar, beatUnit };
}

export function bpmOptions(songBpm: number, current: number | null): Option<string>[] {
  const whole = range(MIN_BPM, MAX_BPM);
  const values = current !== null && !whole.includes(current) ? [...whole, current].sort((a, b) => a - b) : whole;
  return [{ value: SONG_TEMPO, label: `Song tempo (${songBpm})` }, ...values.map((bpm) => ({ value: String(bpm), label: String(bpm) }))];
}
