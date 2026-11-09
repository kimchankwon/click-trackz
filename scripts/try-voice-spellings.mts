import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { inParallel, MAX_CONCURRENT_REQUESTS, SAMPLE_RATE, synthesize, transcribe, trimSilence, wav } from "./voice-pack-audio.mts";
import { slug, speakers } from "./voice-pack-clips.mts";

const [outDir, expected, ...spellings] = process.argv.slice(2);
if (!outDir || !expected || spellings.length === 0) throw new Error("Usage: try-voice-spellings.mts <outDir> <expected word> <spelling>...");

const jobs = speakers.flatMap((speaker) => spellings.map((spelling) => ({ speaker, spelling })));
const rows: { speaker: string; spelling: string; ms: number; heard: string }[] = [];
await inParallel(jobs, MAX_CONCURRENT_REQUESTS - 1, async ({ speaker, spelling }) => {
  const dir = path.resolve(outDir, speaker.id);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${slug(spelling)}.wav`);
  const pcm = trimSilence(await synthesize(speaker.voiceId, `${spelling}.`));
  await writeFile(file, wav(pcm));
  rows.push({ speaker: speaker.id, spelling, ms: Math.round((pcm.length / SAMPLE_RATE) * 1000), heard: await transcribe(file) });
});
const right = (heard: string) => heard.toLowerCase().replace(/[^a-z]/g, "") === expected.toLowerCase().replace(/[^a-z]/g, "");
for (const spelling of spellings) {
  const mine = rows.filter((row) => row.spelling === spelling).sort((a, b) => a.speaker.localeCompare(b.speaker));
  console.log(`"${spelling}": ${mine.filter((row) => right(row.heard)).length}/${mine.length} heard as ${expected}  ` + mine.map((row) => `${row.speaker} ${row.ms}ms "${row.heard}"`).join(", "));
}
