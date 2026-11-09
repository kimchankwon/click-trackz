import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { inParallel, MAX_CONCURRENT_REQUESTS, SAMPLE_RATE, synthesize, trimSilence, wav } from "./voice-pack-audio.mts";
import { clips, speakers } from "./voice-pack-clips.mts";

const args = process.argv.slice(2);
const replace = args.includes("--replace");
const outRoot = path.resolve(args.find((arg) => !arg.startsWith("--")) ?? "assets/voice");
const writesAppClips = outRoot === path.resolve("assets/voice");

const exists = (file: string) => access(file).then(() => true, () => false);

const jobs = speakers.flatMap((speaker) => clips.map((clip) => ({ speaker, clip })));
await inParallel(jobs, MAX_CONCURRENT_REQUESTS, async ({ speaker, clip }) => {
  const outDir = path.join(outRoot, speaker.id);
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${clip.key}.wav`);
  if (!replace && (await exists(file))) return;
  const pcm = trimSilence(await synthesize(speaker.voiceId, clip.text));
  await writeFile(file, wav(pcm));
  console.log(`${speaker.id}/${clip.key}.wav ${((pcm.length / SAMPLE_RATE) * 1000).toFixed(0)} ms`);
});

if (writesAppClips) {
  const manifest = [
    "export const speakers = [",
    ...speakers.map((speaker) => `  { id: "${speaker.id}", name: "${speaker.name}" },`),
    "] as const;",
    "",
    "export type SpeakerId = (typeof speakers)[number][\"id\"];",
    "",
    "export const builtinVoiceClips = {",
    ...speakers.flatMap((speaker) => [
      `  ${speaker.id}: {`,
      ...clips.map((clip) => `    "${clip.key}": require("../../assets/voice/${speaker.id}/${clip.key}.wav"),`),
      "  },",
    ]),
    "} as const;",
    "",
    "export type BuiltinClipKey = keyof (typeof builtinVoiceClips)[SpeakerId];",
    "",
  ].join("\n");
  await writeFile(path.resolve("src/audio/builtin-voice-clips.ts"), manifest);
}
console.log(`${speakers.length} Speakers, ${clips.length} clips each, in ${path.relative(process.cwd(), outRoot) || outRoot}`);
