import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { synthesize, transcribe, trimSilence, wav } from "./voice-pack-audio.mts";
import { clips, numberWords, speakers } from "./voice-pack-clips.mts";

const [dirArg, reportArg, triesArg] = process.argv.slice(2);
if (!dirArg || !reportArg) throw new Error("Usage: reroll-voice-clips.mts <dir> <check report.json> [tries]");
const dir = path.resolve(dirArg);
const tries = Number(triesArg ?? 4);

const digits = Object.fromEntries(numberWords.map((word, n) => [String(n), word]));
const comparable = (text: string) =>
  text
    .toLowerCase()
    .replace(/\d+/g, (n) => digits[n] ?? n)
    .replace(/[^a-z]/g, "");

const report = JSON.parse(await readFile(reportArg, "utf8")) as { speaker: string; key: string; match: boolean }[];
for (const miss of report.filter((row) => !row.match)) {
  const speaker = speakers.find((candidate) => candidate.id === miss.speaker);
  const clip = clips.find((candidate) => candidate.key === miss.key);
  if (!speaker || !clip) continue;
  const file = path.join(dir, speaker.id, `${clip.key}.wav`);
  let heard = "";
  let attempt = 0;
  while (attempt < tries) {
    attempt += 1;
    await writeFile(file, wav(trimSilence(await synthesize(speaker.voiceId, clip.text))));
    heard = await transcribe(file);
    if (comparable(heard) === comparable(clip.heard)) break;
  }
  const fixed = comparable(heard) === comparable(clip.heard);
  console.log(`${fixed ? "FIXED  " : "STILL  "} ${speaker.id}/${clip.key} after ${attempt} ${attempt === 1 ? "try" : "tries"}: heard "${heard}"`);
}
