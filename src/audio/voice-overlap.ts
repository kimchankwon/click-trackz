export const SPOKEN_COUNT_OVERLAP_MS = 100;

export const voiceEndsAt = (beatAt: number, leadMs: number, clipMs: number) => beatAt - leadMs + clipMs;

export const spokenCountFits = (countAt: number, countLeadMs: number, voiceBusyUntil: number) =>
  countAt - countLeadMs >= voiceBusyUntil - SPOKEN_COUNT_OVERLAP_MS;
