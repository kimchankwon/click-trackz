import { writeFile } from "node:fs/promises";
import path from "node:path";

import { SAMPLE_RATE, synthesize, transcribe, trimSilence, wav } from "./voice-pack-audio.mts";
import { clips, numberWords, speakers } from "./voice-pack-clips.mts";

const [dirArg, takesArg, ...targets] = process.argv.slice(2);
if (!dirArg || targets.length === 0) throw new Error("Usage: shorten-voice-clips.mts <dir> <takes> <speaker/key>...");
const dir = path.resolve(dirArg);
const takes = Number(takesArg);

const digits = Object.fromEntries(numberWords.map((word, n) => [String(n), word]));
const comparable = (text: string) =>
  text
    .toLowerCase()
    .replace(/\d+/g, (n) => digits[n] ?? n)
    .replace(/[^a-z]/g, "");

for (const target of targets) {
  const [speakerId, key] = target.split("/");
  const speaker = speakers.find((candidate) => candidate.id === speakerId);
  const clip = clips.find((candidate) => candidate.key === key);
  if (!speaker || !clip) throw new Error(`Unknown clip ${target}`);
  const file = path.join(dir, speaker.id, `${clip.key}.wav`);
  const trial = path.join(dir, speaker.id, `${clip.key}.trial.wav`);
  let best: Int16Array | null = null;
  for (let take = 1; take <= takes; take++) {
    const pcm = trimSilence(await synthesize(speaker.voiceId, clip.text));
    await writeFile(trial, wav(pcm));
    const heard = await transcribe(trial);
    if (comparable(heard) === comparable(clip.heard) && (best === null || pcm.length < best.length)) best = pcm;
  }
  if (best) await writeFile(file, wav(best));
  await writeFile(trial, Buffer.alloc(0));
  console.log(`${target}: ${best ? `kept a ${Math.round((best.length / SAMPLE_RATE) * 1000)} ms take` : "no take read back right, left as it was"}`);
}
