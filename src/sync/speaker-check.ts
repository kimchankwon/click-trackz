import { MAX_BARS, type Playback, type Song } from "./timeline";

export const SPEAKER_CHECK_BPM = 60;
const SPEAKER_CHECK_BEATS_PER_BAR = 4;
export const SPEAKER_CHECK_MS = 5 * 60_000;

const BAR_MS = (SPEAKER_CHECK_BEATS_PER_BAR * 60_000) / SPEAKER_CHECK_BPM;

export type SpeakerCheck = {
  startsAt: number;
  stopsAt: number;
  listenTo: string | null;
  comparedWith: string;
};

export type SpeakerCheckPlan = { song: Song; playback: Playback };

export const speakerCheckBars = (check: Pick<SpeakerCheck, "startsAt" | "stopsAt">) =>
  Math.min(MAX_BARS, Math.max(1, Math.ceil((check.stopsAt - check.startsAt) / BAR_MS)));

export function speakerCheckPlan(check: Pick<SpeakerCheck, "startsAt" | "stopsAt">): SpeakerCheckPlan {
  return {
    song: {
      countIn: false,
      cueLeadBars: 1,
      sections: [
        {
          sectionType: "Speaker check",
          bars: speakerCheckBars(check),
          beatsPerBar: SPEAKER_CHECK_BEATS_PER_BAR,
          beatUnit: 4,
          bpm: SPEAKER_CHECK_BPM,
          voiceCueEnabled: false,
        },
      ],
    },
    playback: { startsAt: check.startsAt, startSection: 0, jumps: [], stopsAt: check.stopsAt },
  };
}

export const speakerCheckLive = (check: Pick<SpeakerCheck, "stopsAt"> | null, nowMs: number | null) =>
  check !== null && nowMs !== null && nowMs < check.stopsAt;

export const playsInSpeakerCheck = (check: Pick<SpeakerCheck, "listenTo" | "comparedWith">, deviceId: string) =>
  check.listenTo === null || check.listenTo === deviceId || check.comparedWith === deviceId;
