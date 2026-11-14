import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { apiKey } from "./voice-pack-clips.mts";

export const SAMPLE_RATE = 22_050;
export const SPEED = 1.2;
const SILENCE_THRESHOLD = 330;
const TAIL_SHARE_OF_PEAK = 0.03;
const PRE_ROLL_SAMPLES = Math.round(SAMPLE_RATE * 0.004);
const TAIL_KEEP_SAMPLES = Math.round(SAMPLE_RATE * 0.02);
const FADE_SAMPLES = Math.round(SAMPLE_RATE * 0.015);
const PAD_SECONDS = 0.5;

export function trimSilence(pcm: Int16Array): Int16Array {
  let first = 0;
  while (first < pcm.length && Math.abs(pcm[first]) < SILENCE_THRESHOLD) first++;
  const peak = pcm.reduce((loudest, sample) => Math.max(loudest, Math.abs(sample)), 0);
  const tailThreshold = Math.max(SILENCE_THRESHOLD, peak * TAIL_SHARE_OF_PEAK);
  let last = pcm.length - 1;
  while (last > first && Math.abs(pcm[last]) < tailThreshold) last--;
  const trimmed = Int16Array.from(pcm.subarray(Math.max(0, first - PRE_ROLL_SAMPLES), Math.min(pcm.length, last + 1 + TAIL_KEEP_SAMPLES)));
  const fade = Math.min(FADE_SAMPLES, trimmed.length);
  for (let index = 0; index < fade; index++) {
    const at = trimmed.length - fade + index;
    trimmed[at] = Math.round(trimmed[at] * (1 - (index + 1) / fade));
  }
  return trimmed;
}

export function wav(pcm: Int16Array): Buffer {
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

const run = promisify(execFile);
const FFMPEG_EXACT = ["-v", "error", "-y", "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact"];
const FLAC_STREAMINFO = 0;
const LAST_BLOCK = 0x80;

function withoutPadding(encoded: Buffer): Buffer {
  const streaminfoLength = encoded.readUIntBE(5, 3);
  if (encoded.toString("latin1", 0, 4) !== "fLaC" || (encoded[4] & 0x7f) !== FLAC_STREAMINFO) throw new Error("Not a FLAC file");
  let at = 4;
  while (!(encoded[at] & LAST_BLOCK)) at += 4 + encoded.readUIntBE(at + 1, 3);
  const frames = encoded.subarray(at + 4 + encoded.readUIntBE(at + 1, 3));
  const streaminfo = Buffer.from(encoded.subarray(4, 8 + streaminfoLength));
  streaminfo[0] = LAST_BLOCK | FLAC_STREAMINFO;
  return Buffer.concat([encoded.subarray(0, 4), streaminfo, frames]);
}

export async function writeClip(file: string, pcm: Int16Array) {
  const source = `${file}.source.wav`;
  await writeFile(source, wav(pcm));
  try {
    await run("ffmpeg", ["-i", source, ...FFMPEG_EXACT, "-c:a", "flac", "-compression_level", "12", file]);
  } finally {
    await rm(source, { force: true });
  }
  await writeFile(file, withoutPadding(await readFile(file)));
}

export async function readClip(file: string): Promise<Int16Array> {
  const { stdout } = await run("ffmpeg", ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", String(SAMPLE_RATE), "pipe:1"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  return new Int16Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength));
}

export const MAX_CONCURRENT_REQUESTS = 3;

async function withRetry(label: string, request: () => Promise<Response>): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await request();
    if (response.ok) return response;
    if (response.status === 429 && attempt < 6) {
      await new Promise((done) => setTimeout(done, attempt * 2_000));
      continue;
    }
    throw new Error(`${label}: ${response.status} ${await response.text()}`);
  }
}

export type Delivery = { stability?: number; speed?: number };

export async function synthesize(voiceId: string, text: string, delivery: Delivery = {}): Promise<Int16Array> {
  const { stability = 0.8, speed = SPEED } = delivery;
  const response = await withRetry(text, () =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_${SAMPLE_RATE}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability, similarity_boost: 0.75, speed },
      }),
    }),
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + Math.floor(bytes.byteLength / 2) * 2));
}

function padded(pcm: Int16Array): Int16Array {
  const silence = Math.round(SAMPLE_RATE * PAD_SECONDS);
  const out = new Int16Array(pcm.length + silence * 2);
  out.set(pcm, silence);
  return out;
}

export async function transcribe(file: string): Promise<string> {
  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append("language_code", "en");
  form.append("file", new Blob([wav(padded(await readClip(file)))], { type: "audio/wav" }), `${path.parse(file).name}.wav`);
  const response = await withRetry(file, () => fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": apiKey() }, body: form }));
  return ((await response.json()) as { text: string }).text.trim();
}

export async function inParallel<T>(items: readonly T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
}
