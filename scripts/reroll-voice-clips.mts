import { readFile } from "node:fs/promises";
import path from "node:path";

import { synthesize, transcribe, writeClip } from "./voice-pack-audio.mts";
import { cleanedTake, finishedFor } from "./voice-pack-measure.mts";
import { clips, comparable, deliveryOf, speakers, voiceIdFor, type VoiceSpeedId } from "./voice-pack-clips.mts";

const [dirArg, reportArg, triesArg] = process.argv.slice(2);
if (!dirArg || !reportArg) throw new Error("Usage: reroll-voice-clips.mts <dir> <check report.json> [tries]");
const dir = path.resolve(dirArg);
const tries = Number(triesArg ?? 4);

const report = JSON.parse(await readFile(reportArg, "utf8")) as { voiceSpeed: VoiceSpeedId; speaker: string; key: string; match: boolean }[];
for (const miss of report.filter((row) => !row.match)) {
  const speaker = speakers.find((candidate) => candidate.id === miss.speaker);
  const clip = clips.find((candidate) => candidate.key === miss.key);
  if (!speaker || !clip) continue;
  const file = path.join(dir, miss.voiceSpeed, speaker.id, `${clip.key}.flac`);
  let heard = "";
  let attempt = 0;
  while (attempt < tries) {
    attempt += 1;
    await writeClip(file, finishedFor(speaker, cleanedTake(await synthesize(voiceIdFor(speaker, miss.voiceSpeed), clip.text, deliveryOf(miss.voiceSpeed)))));
    heard = await transcribe(file);
    if (comparable(heard) === comparable(clip.heard)) break;
  }
  const fixed = comparable(heard) === comparable(clip.heard);
  console.log(`${fixed ? "FIXED  " : "STILL  "} ${miss.voiceSpeed}/${speaker.id}/${clip.key} after ${attempt} ${attempt === 1 ? "try" : "tries"}: heard "${heard}"`);
}
