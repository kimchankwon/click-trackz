import { readFile } from "node:fs/promises";
import path from "node:path";

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

export async function synthesize(voiceId: string, text: string, speed = SPEED): Promise<Int16Array> {
  const response = await withRetry(text, () =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_${SAMPLE_RATE}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.8, similarity_boost: 0.75, speed },
      }),
    }),
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  return new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + Math.floor(bytes.byteLength / 2) * 2));
}

function padded(clip: Buffer): Buffer {
  const rate = clip.readUInt32LE(24);
  const silence = Buffer.alloc(Math.round(rate * PAD_SECONDS) * 2);
  const body = Buffer.concat([silence, clip.subarray(44), silence]);
  const header = Buffer.from(clip.subarray(0, 44));
  header.writeUInt32LE(36 + body.length, 4);
  header.writeUInt32LE(body.length, 40);
  return Buffer.concat([header, body]);
}

export async function transcribe(file: string): Promise<string> {
  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append("language_code", "en");
  form.append("file", new Blob([padded(await readFile(file))], { type: "audio/wav" }), path.basename(file));
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
