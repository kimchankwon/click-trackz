import { writeFile } from "node:fs/promises";
import path from "node:path";

import { inParallel, MAX_CONCURRENT_REQUESTS, transcribe } from "./voice-pack-audio.mts";
import { clips, numberWords, speakers, voiceSpeeds } from "./voice-pack-clips.mts";

const dir = path.resolve(process.argv[2] ?? "assets/voice");
const reportFile = process.argv[3];

const digits = Object.fromEntries(numberWords.map((word, n) => [String(n), word]));
export const comparable = (text: string) =>
  text
    .toLowerCase()
    .replace(/\d+/g, (n) => digits[n] ?? n)
    .replace(/[^a-z]/g, "");

const jobs = voiceSpeeds.flatMap(({ id: voiceSpeed }) => speakers.flatMap((speaker) => clips.map((clip) => ({ voiceSpeed, speaker: speaker.id, clip }))));
const results: { voiceSpeed: string; speaker: string; key: string; expected: string; heard: string; match: boolean }[] = [];
await inParallel(jobs, MAX_CONCURRENT_REQUESTS, async ({ voiceSpeed, speaker, clip }) => {
  const heard = await transcribe(path.join(dir, voiceSpeed, speaker, `${clip.key}.flac`));
  results.push({ voiceSpeed, speaker, key: clip.key, expected: clip.heard, heard, match: comparable(heard) === comparable(clip.heard) });
});
results.sort((a, b) => a.voiceSpeed.localeCompare(b.voiceSpeed) || a.speaker.localeCompare(b.speaker) || a.key.localeCompare(b.key));
const misses = results.filter((result) => !result.match);
for (const miss of misses) console.log(`MISHEARD ${miss.voiceSpeed}/${miss.speaker}/${miss.key}: expected "${miss.expected}", heard "${miss.heard}"`);
console.log(`${results.length} clips checked in ${path.relative(process.cwd(), dir) || dir}, ${misses.length} misheard`);
if (reportFile) await writeFile(reportFile, JSON.stringify(results, null, 2));
