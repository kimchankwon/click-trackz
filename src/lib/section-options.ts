import { timeSignatureOf, type Section } from "@/sync/timeline";

export const MAX_SECTION_NUMBER = 9;

type Option<T extends string> = { value: T; label: string };

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


export function timeOptions(current: Pick<Section, "beatsPerBar" | "beatUnit">): Option<string>[] {
  const keys = COMMON_TIME_SIGNATURES.map(([beatsPerBar, beatUnit]) => timeSignatureOf({ beatsPerBar, beatUnit }));
  const picked = timeSignatureOf(current);
  return (keys.includes(picked) ? keys : [picked, ...keys]).map((key) => ({ value: key, label: key }));
}

export function timeOfKey(key: string): Pick<Section, "beatsPerBar" | "beatUnit"> {
  const [beatsPerBar, beatUnit] = key.split("/").map(Number);
  return { beatsPerBar, beatUnit };
}
