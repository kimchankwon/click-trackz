export type Speaker = { id: string; name: string; voiceId: string; voice: "female" | "male"; cloned?: boolean; normalVoiceId?: string };

export const speakers: Speaker[] = [
  { id: "alice", name: "Alice", voiceId: "Xb7hH8MSUJpSbSDYk0k2", voice: "female" },
  { id: "sarah", name: "Sarah", voiceId: "EXAVITQu4vr4xnSDxMaL", voice: "female" },
  { id: "river", name: "River", voiceId: "SAz9YHcvj6GT2YYXdXww", voice: "female" },
  { id: "brooke", name: "Brooke Ligertwood", voiceId: "S1q9ObobvxvWQptpVTCY", voice: "female", cloned: true },
  { id: "josh", name: "Josh Kim", voiceId: "HTcuMsOw3RSsyFQX4e10", voice: "male", cloned: true, normalVoiceId: "kDdd9ze5WSTpbw4OBBqo" },
  { id: "charlie", name: "Charlie", voiceId: "IKne3meq5aSn9XLyUdCD", voice: "male" },
  { id: "adam", name: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB", voice: "male" },
  { id: "george", name: "George", voiceId: "JBFqnCBsd6RMkjVDRZzb", voice: "male" },
  { id: "aodhan", name: "Aodhan King", voiceId: "PnUSoJmZiZ8lEKcre7RV", voice: "male", cloned: true },
  { id: "sijin", name: "Sijin Yang", voiceId: "Ml6hRC8LLk4hmcUNRkgk", voice: "male", cloned: true },
];

export const sectionTypes = [
  "Intro", "Verse", "Pre-Chorus", "Chorus", "Post-Chorus", "Bridge", "Interlude", "Turnaround",
  "Instrumental", "Solo", "Tag", "Vamp", "Breakdown", "Build", "Outro", "Ending",
];

const numberedTypes = ["Verse", "Pre-Chorus", "Chorus", "Bridge"];
export const numberWords = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];

export const spokenAs: Record<string, string> = { Outro: "Outtro" };

export const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const say = (word: string) => spokenAs[word] ?? word;

export type Clip = { key: string; text: string; heard: string };

export const clips: Clip[] = [
  ...sectionTypes.map((type) => ({ key: slug(type), text: `${say(type)}.`, heard: type })),
  ...numberedTypes.flatMap((type) =>
    [1, 2, 3, 4].map((n) => ({ key: `${slug(type)}-${n}`, text: `${say(type)} ${numberWords[n]}.`, heard: `${type} ${numberWords[n]}` })),
  ),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ key: `count-${n}`, text: `${numberWords[n]}.`, heard: numberWords[n] })),
];

export const apiKey = () => {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  return key;
};

export const voiceSpeeds = [
  { id: "faster", speed: 1.2 },
  { id: "normal", speed: 1 },
] as const;

export type VoiceSpeedId = (typeof voiceSpeeds)[number]["id"];

const speedOf = (id: VoiceSpeedId) => voiceSpeeds.find((option) => option.id === id)!.speed;

export const voiceIdFor = (speaker: Speaker, voiceSpeed: VoiceSpeedId) => (voiceSpeed === "normal" ? (speaker.normalVoiceId ?? speaker.voiceId) : speaker.voiceId);

export const deliveryOf = (voiceSpeed: VoiceSpeedId = "faster") => ({ speed: speedOf(voiceSpeed) });
