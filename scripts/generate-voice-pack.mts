import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { inParallel, MAX_CONCURRENT_REQUESTS, SAMPLE_RATE, synthesize, transcribe, wav } from "./voice-pack-audio.mts";
import { clips, deliveryOf, voiceIdFor, numberWords, speakers, voiceSpeeds, type VoiceSpeedId } from "./voice-pack-clips.mts";
import { cleanedTake, endingSemitones, finishedFor, takeScore } from "./voice-pack-measure.mts";

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const retakeRising = args.includes("--retake-rising");
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const takes = Number(option("takes") ?? 3);
const only = option("only")?.split(",");
const outRoot = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? "assets/voice");
const writesAppClips = outRoot === path.resolve("assets/voice");
const speedArg = option("speed");
const chosenSpeeds = voiceSpeeds.filter((option) => speedArg === undefined || option.id === speedArg).map((option) => option.id as VoiceSpeedId);
const EXTRA_TAKES = 5;
const RETRY_SPEED_STEP = 0.1;
const MOST_SLOWED_BY = 0.1;
const RISING_RETAKE_SEMITONES = 3;

const exists = (file: string) => access(file).then(() => true, () => false);
const digits = Object.fromEntries(numberWords.map((word, n) => [String(n), word]));
const comparable = (text: string) =>
  text
    .toLowerCase()
    .replace(/\d+/g, (n) => digits[n] ?? n)
    .replace(/[^a-z]/g, "");

const scratch = await mkdtemp(path.join(os.tmpdir(), "voice-pack-"));
const chosen = speakers.filter((speaker) => only === undefined || only.includes(speaker.id));
const jobs = chosenSpeeds.flatMap((voiceSpeed) => chosen.flatMap((speaker) => clips.map((clip) => ({ voiceSpeed, speaker, clip }))));
await inParallel(jobs, MAX_CONCURRENT_REQUESTS, async ({ voiceSpeed, speaker, clip }) => {
  const outDir = path.join(outRoot, voiceSpeed, speaker.id);
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${clip.key}.wav`);
  let kept: { pcm: Int16Array; score: number } | null = null;
  if (!replace && (await exists(file))) {
    if (!retakeRising) return;
    const bytes = await readFile(file);
    const pcm = new Int16Array(bytes.buffer.slice(bytes.byteOffset + 44, bytes.byteOffset + bytes.byteLength));
    if ((endingSemitones(pcm) ?? 0) <= RISING_RETAKE_SEMITONES) return;
    kept = { pcm, score: takeScore(pcm) };
  }
  const trial = path.join(scratch, `${voiceSpeed}-${speaker.id}-${clip.key}.wav`);
  let best: { pcm: Int16Array; score: number; speed: number } | null = null;
  const delivery = deliveryOf(voiceSpeed);
  const slowest = Math.max(1, delivery.speed - MOST_SLOWED_BY);
  for (let speed = delivery.speed; best === null && speed >= slowest - 0.001; speed -= RETRY_SPEED_STEP) {
    const tries = speed === delivery.speed ? takes + EXTRA_TAKES : takes;
    for (let take = 1; take <= tries; take++) {
      if (best && take > takes) break;
      const pcm = cleanedTake(await synthesize(voiceIdFor(speaker, voiceSpeed), clip.text, { ...delivery, speed }));
      await writeFile(trial, wav(pcm));
      if (comparable(await transcribe(trial)) !== comparable(clip.heard)) continue;
      const score = takeScore(pcm);
      if (best === null || score < best.score) best = { pcm, score, speed };
    }
  }
  if (best === null) {
    console.log(`${voiceSpeed}/${speaker.id}/${clip.key}.wav NO TAKE READ BACK RIGHT, left as it was`);
    process.exitCode = 1;
    return;
  }
  if (kept !== null && best.score >= kept.score) return;
  const final = finishedFor(speaker, best.pcm);
  await writeFile(file, wav(final));
  const ending = endingSemitones(final);
  console.log(`${voiceSpeed}/${speaker.id}/${clip.key}.wav ${((final.length / SAMPLE_RATE) * 1000).toFixed(0)} ms, ends ${ending === null ? "unvoiced" : `${ending.toFixed(1)} st`}${best.speed < delivery.speed - 0.001 ? `, at ${best.speed.toFixed(1)}x` : ""}`);
});
await rm(scratch, { recursive: true, force: true });

const missing = writesAppClips
  ? (
      await Promise.all(
        voiceSpeeds.flatMap(({ id: voiceSpeed }) =>
          speakers.flatMap((speaker) => clips.map(async (clip) => ((await exists(path.join(outRoot, voiceSpeed, speaker.id, `${clip.key}.wav`))) ? null : `${voiceSpeed}/${speaker.id}/${clip.key}.wav`))),
        ),
      )
    ).filter((file) => file !== null)
  : [];
if (missing.length > 0) {
  console.log(`Left src/audio/builtin-voice-clips.ts as it was: ${missing.length === 1 ? "1 clip is" : `${missing.length} clips are`} missing, such as ${missing.slice(0, 5).join(", ")}`);
  process.exitCode = 1;
}
if (writesAppClips && missing.length === 0) {
  const manifest = [
    "export const speakers = [",
    ...speakers.map((speaker) => `  { id: "${speaker.id}", name: "${speaker.name}", voice: "${speaker.voice}" },`),
    "] as const;",
    "",
    "export type SpeakerId = (typeof speakers)[number][\"id\"];",
    "",
    `export const voiceSpeeds = [${voiceSpeeds.map((option) => `"${option.id}"`).join(", ")}] as const;`,
    "",
    "export type VoiceSpeed = (typeof voiceSpeeds)[number];",
    "",
    "export const builtinVoiceClips = {",
    ...voiceSpeeds.flatMap(({ id: voiceSpeed }) => [
      `  ${voiceSpeed}: {`,
      ...speakers.flatMap((speaker) => [
        `    ${speaker.id}: {`,
        ...clips.map((clip) => `      "${clip.key}": require("../../assets/voice/${voiceSpeed}/${speaker.id}/${clip.key}.wav"),`),
        "    },",
      ]),
      "  },",
    ]),
    "} as const;",
    "",
    "export type BuiltinClipKey = keyof (typeof builtinVoiceClips)[VoiceSpeed][SpeakerId];",
    "",
  ].join("\n");
  await writeFile(path.resolve("src/audio/builtin-voice-clips.ts"), manifest);
}
console.log(`${chosen.length} Speakers, ${chosenSpeeds.join(" and ")}, ${clips.length} clips each, in ${path.relative(process.cwd(), outRoot) || outRoot}`);
