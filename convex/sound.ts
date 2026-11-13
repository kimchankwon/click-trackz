import { v, type Infer } from "convex/values";

export const soundFields = v.object({
  clickVolume: v.number(),
  voiceVolume: v.number(),
  speaker: v.string(),
  voiceSpeed: v.optional(v.union(v.literal("normal"), v.literal("faster"))),
  click: v.boolean(),
  voiceCues: v.boolean(),
  spokenCounts: v.boolean(),
});

export type SoundSettings = Infer<typeof soundFields>;

export const defaultSound: SoundSettings = {
  clickVolume: 0.8,
  voiceVolume: 0.9,
  speaker: "adam",
  voiceSpeed: "faster",
  click: true,
  voiceCues: true,
  spokenCounts: true,
};

const clampVolume = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function cleanSound(sound: SoundSettings): SoundSettings {
  return {
    ...sound,
    clickVolume: clampVolume(sound.clickVolume),
    voiceVolume: clampVolume(sound.voiceVolume),
    speaker: sound.speaker.trim().slice(0, 32) || defaultSound.speaker,
  };
}
