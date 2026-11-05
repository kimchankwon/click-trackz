import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

const speakers = [
  { id: "adam", name: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB" },
  { id: "alice", name: "Alice", voiceId: "Xb7hH8MSUJpSbSDYk0k2" },
  { id: "charlie", name: "Charlie", voiceId: "IKne3meq5aSn9XLyUdCD" },
  { id: "sarah", name: "Sarah", voiceId: "EXAVITQu4vr4xnSDxMaL" },
];
const SAMPLE_RATE = 22_050;
const SILENCE_THRESHOLD = 330;
const PRE_ROLL_SAMPLES = Math.round(SAMPLE_RATE * 0.004);

const sectionTypes = [
  "Intro", "Verse", "Pre-Chorus", "Chorus", "Post-Chorus", "Bridge", "Interlude", "Turnaround",
  "Instrumental", "Solo", "Tag", "Vamp", "Breakdown", "Build", "Outro", "Ending",
];
const numberedTypes = ["Verse", "Pre-Chorus", "Chorus", "Bridge"];
const numberWords = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const clips: { key: string; text: string }[] = [
  ...sectionTypes.map((type) => ({ key: slug(type), text: `${type}.` })),
  ...numberedTypes.flatMap((type) =>
    [1, 2, 3, 4].map((n) => ({ key: `${slug(type)}-${n}`, text: `${type} ${numberWords[n]}.` })),
  ),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ key: `count-${n}`, text: `${numberWords[n]}.` })),
];

function trimSilence(pcm: Int16Array): Int16Array {
  let first = 0;
  while (first < pcm.length && Math.abs(pcm[first]) < SILENCE_THRESHOLD) first++;
  let last = pcm.length - 1;
  while (last > first && Math.abs(pcm[last]) < SILENCE_THRESHOLD) last--;
  return pcm.subarray(Math.max(0, first - PRE_ROLL_SAMPLES), last + 1);
}

function wav(pcm: Int16Array): Buffer {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function synthesize(voiceId: string, text: string): Promise<Int16Array> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_${SAMPLE_RATE}`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey!, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.8, similarity_boost: 0.75, speed: 1.15 },
      }),
    },
  );
  if (!response.ok) throw new Error(`${text}: ${response.status} ${await response.text()}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

const exists = (file: string) => access(file).then(() => true, () => false);

for (const speaker of speakers) {
  const outDir = path.resolve("assets/voice", speaker.id);
  await mkdir(outDir, { recursive: true });
  for (const clip of clips) {
    const file = path.join(outDir, `${clip.key}.wav`);
    if (await exists(file)) continue;
    const pcm = trimSilence(await synthesize(speaker.voiceId, clip.text));
    await writeFile(file, wav(pcm));
    console.log(`${speaker.id}/${clip.key}.wav ${((pcm.length / SAMPLE_RATE) * 1000).toFixed(0)} ms`);
  }
}

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
console.log(`${speakers.length} Speakers, ${clips.length} clips each`);
