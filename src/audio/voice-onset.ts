const WINDOW_MS = 5;
const SEARCH_MS = 400;
const ONSET_SHARE = 0.5;

export const MAX_VOICE_LEAD_MS = 150;
export const VOICE_EARLY_MS = 40;

export function perceivedOnsetMs(samples: Float32Array, sampleRate: number): number {
  const window = Math.max(1, Math.round((sampleRate * WINDOW_MS) / 1000));
  const limit = Math.min(samples.length, Math.round((sampleRate * SEARCH_MS) / 1000));
  const levels: number[] = [];
  for (let start = 0; start < limit; start += window) {
    const end = Math.min(limit, start + window);
    let energy = 0;
    for (let index = start; index < end; index++) energy += samples[index] * samples[index];
    levels.push(Math.sqrt(energy / (end - start)));
  }
  const peak = levels.reduce((loudest, level) => Math.max(loudest, level), 0);
  if (peak === 0) return 0;
  const onsetWindow = levels.findIndex((level) => level >= peak * ONSET_SHARE);
  return Math.min(MAX_VOICE_LEAD_MS, (onsetWindow * window * 1000) / sampleRate);
}

export const voiceLeadMs = (samples: Float32Array, sampleRate: number) => perceivedOnsetMs(samples, sampleRate) + VOICE_EARLY_MS;
