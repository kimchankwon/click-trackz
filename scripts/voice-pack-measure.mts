import { SAMPLE_RATE, trimSilence } from "./voice-pack-audio.mts";

const FRAME = Math.round(SAMPLE_RATE * 0.03);
const HOP = Math.round(SAMPLE_RATE * 0.01);
const LOWEST_HZ = 70;
const HIGHEST_HZ = 420;
const VOICED_SHARE_OF_PEAK = 0.08;
const PERIODIC = 0.45;
const ACTIVE_SHARE_OF_PEAK = 0.02;

export const TARGET_RMS_DB = -17;
export const PEAK_CEILING_DB = -1;

const peakOf = (pcm: Int16Array) => pcm.reduce((loudest, sample) => Math.max(loudest, Math.abs(sample)), 0);

function pitchOf(frame: Float64Array): number | null {
  const mean = frame.reduce((sum, x) => sum + x, 0) / frame.length;
  const centred = frame.map((x) => x - mean);
  const energy = centred.reduce((sum, x) => sum + x * x, 0);
  if (energy === 0) return null;
  const shortest = Math.floor(SAMPLE_RATE / HIGHEST_HZ);
  const longest = Math.floor(SAMPLE_RATE / LOWEST_HZ);
  let bestLag = 0;
  let best = -Infinity;
  for (let lag = shortest; lag < Math.min(longest, centred.length); lag++) {
    let sum = 0;
    for (let i = 0; i + lag < centred.length; i++) sum += centred[i] * centred[i + lag];
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  return best / energy > PERIODIC ? SAMPLE_RATE / bestLag : null;
}

export function pitchTrack(pcm: Int16Array): number[] {
  const peak = peakOf(pcm) || 1;
  const pitches: number[] = [];
  for (let start = 0; start + FRAME < pcm.length; start += HOP) {
    const frame = Float64Array.from(pcm.subarray(start, start + FRAME), (x) => x / 32768);
    const rms = Math.sqrt(frame.reduce((sum, x) => sum + x * x, 0) / frame.length);
    if (rms < (VOICED_SHARE_OF_PEAK * peak) / 32768) continue;
    const pitch = pitchOf(frame);
    if (pitch !== null) pitches.push(pitch);
  }
  return pitches;
}

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? NaN : sorted[Math.floor(sorted.length / 2)];
};

export function endingSemitones(pcm: Int16Array): number | null {
  const pitches = pitchTrack(pcm);
  if (pitches.length < 4) return null;
  const third = Math.max(2, Math.floor(pitches.length / 3));
  return 12 * Math.log2(median(pitches.slice(-third)) / median(pitches.slice(0, third)));
}

export const medianPitch = (pcm: Int16Array) => median(pitchTrack(pcm));

export function activeRmsDb(pcm: Int16Array): number {
  const floor = peakOf(pcm) * ACTIVE_SHARE_OF_PEAK;
  let sum = 0;
  let count = 0;
  for (const sample of pcm) {
    if (Math.abs(sample) <= floor) continue;
    sum += (sample / 32768) ** 2;
    count++;
  }
  return count === 0 ? -Infinity : 10 * Math.log10(sum / count);
}

export function levelled(pcm: Int16Array): Int16Array {
  const rmsGain = 10 ** ((TARGET_RMS_DB - activeRmsDb(pcm)) / 20);
  const peakGain = (32767 * 10 ** (PEAK_CEILING_DB / 20)) / (peakOf(pcm) || 1);
  const gain = Math.min(rmsGain, peakGain);
  return Int16Array.from(pcm, (sample) => Math.max(-32768, Math.min(32767, Math.round(sample * gain))));
}

const TAIL_WINDOW = Math.round(SAMPLE_RATE * 0.05);
const TAIL_SKIP = Math.round(SAMPLE_RATE * 0.035);
const QUIET_TAIL_DB = -25;

export function tailDb(pcm: Int16Array): number {
  const end = Math.max(0, pcm.length - TAIL_SKIP);
  const window = pcm.subarray(Math.max(0, end - TAIL_WINDOW), end);
  const rms = Math.sqrt(window.reduce((sum, x) => sum + x * x, 0) / Math.max(1, window.length));
  return 20 * Math.log10((rms || 1) / (peakOf(pcm) || 1));
}

const HISS_FRAME = Math.round(SAMPLE_RATE * 0.02);
const HISS_HOP = Math.round(SAMPLE_RATE * 0.01);
const HISS_RATIO = 0.9;
const HISS_ALLOWED_MS = 150;

export function trailingHissMs(pcm: Int16Array): number {
  let frames = 0;
  for (let end = pcm.length; end - HISS_FRAME > 1; end -= HISS_HOP) {
    let level = 0;
    let edge = 0;
    for (let i = end - HISS_FRAME; i < end; i++) {
      level += pcm[i] * pcm[i];
      edge += (pcm[i] - pcm[i - 1]) ** 2;
    }
    if (level === 0 || Math.sqrt(edge / level) <= HISS_RATIO) break;
    frames++;
  }
  return (frames * HISS_HOP * 1000) / SAMPLE_RATE;
}

export function takeScore(pcm: Int16Array): number {
  const ending = endingSemitones(pcm) ?? 0;
  const rising = Math.max(0, ending - 1);
  const crashing = Math.max(0, -ending - 6);
  const cutOff = Math.max(0, tailDb(pcm) - QUIET_TAIL_DB);
  const hiss = Math.max(0, trailingHissMs(pcm) - HISS_ALLOWED_MS) / 50;
  return rising * 3 + crashing + cutOff + hiss + (pcm.length / SAMPLE_RATE) * 2;
}

const ENVELOPE_HOP = Math.round(SAMPLE_RATE * 0.01);
const ENVELOPE_WINDOW = Math.round(SAMPLE_RATE * 0.03);
const SPEECH_WITHIN_DB = 22;
const BREATH_BELOW_DB = 26;
const BREATH_LONGER_THAN = Math.round(SAMPLE_RATE * 0.15);
const KEEP_AFTER_SPEECH = Math.round(SAMPLE_RATE * 0.1);
const BREATH_FADE = Math.round(SAMPLE_RATE * 0.015);

export function withoutTrailingBreath(pcm: Int16Array): Int16Array {
  const levels: number[] = [];
  for (let start = 0; start + ENVELOPE_WINDOW <= pcm.length; start += ENVELOPE_HOP) {
    let sum = 0;
    for (let i = start; i < start + ENVELOPE_WINDOW; i++) sum += pcm[i] * pcm[i];
    levels.push(Math.sqrt(sum / ENVELOPE_WINDOW));
  }
  const loudest = Math.max(...levels, 1);
  const speech = loudest * 10 ** (-SPEECH_WITHIN_DB / 20);
  const lastSpeech = levels.findLastIndex((level) => level >= speech);
  const speechEnds = lastSpeech * ENVELOPE_HOP + ENVELOPE_WINDOW;
  const after = levels.slice(lastSpeech + 1 + Math.round(KEEP_AFTER_SPEECH / ENVELOPE_HOP));
  const breath = loudest * 10 ** (-BREATH_BELOW_DB / 20);
  if (pcm.length - speechEnds <= BREATH_LONGER_THAN || after.some((level) => level >= breath)) return pcm;
  const kept = Int16Array.from(pcm.subarray(0, Math.min(pcm.length, speechEnds + KEEP_AFTER_SPEECH)));
  const fade = Math.min(BREATH_FADE, kept.length);
  for (let index = 0; index < fade; index++) {
    const at = kept.length - fade + index;
    kept[at] = Math.round(kept[at] * (1 - (index + 1) / fade));
  }
  return kept;
}

const HISS_KEPT_MS = 180;
const HISS_TRIM_OVER_MS = 250;
const HISS_FADE = Math.round(SAMPLE_RATE * 0.06);

export function withShortHiss(pcm: Int16Array): Int16Array {
  const hissMs = trailingHissMs(pcm);
  if (hissMs <= HISS_TRIM_OVER_MS) return pcm;
  const cut = Math.round(((hissMs - HISS_KEPT_MS) * SAMPLE_RATE) / 1000);
  const kept = Int16Array.from(pcm.subarray(0, pcm.length - cut));
  const fade = Math.min(HISS_FADE, kept.length);
  for (let index = 0; index < fade; index++) {
    const at = kept.length - fade + index;
    kept[at] = Math.round(kept[at] * (1 - (index + 1) / fade));
  }
  return kept;
}

export const cleanedTake = (raw: Int16Array) => withShortHiss(withoutTrailingBreath(trimSilence(raw)));

export const finishedFor = (speaker: { cloned?: boolean }, take: Int16Array) => (speaker.cloned ? levelled(take) : take);
