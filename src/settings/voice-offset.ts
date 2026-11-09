export const VOICE_OFFSET_STEP_MS = 10;
export const VOICE_OFFSET_MIN_MS = -200;
export const VOICE_OFFSET_MAX_MS = 200;

export const isVoiceOffsetSetting = (value: string): value is string =>
  /^-?\d{1,3}$/.test(value) && Number(value) >= VOICE_OFFSET_MIN_MS && Number(value) <= VOICE_OFFSET_MAX_MS;

export const stepVoiceOffset = (ms: number, steps: number) =>
  Math.min(VOICE_OFFSET_MAX_MS, Math.max(VOICE_OFFSET_MIN_MS, Math.round(ms / VOICE_OFFSET_STEP_MS + steps) * VOICE_OFFSET_STEP_MS));

export const voiceOffsetText = (ms: number) => (ms === 0 ? "Default" : `${Math.abs(ms)} ms ${ms > 0 ? "later" : "sooner"}`);
