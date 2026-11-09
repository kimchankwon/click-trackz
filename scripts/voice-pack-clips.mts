export const speakers = [
  { id: "adam", name: "Adam", voiceId: "pNInz6obpgDQGcFmaJgB" },
  { id: "alice", name: "Alice", voiceId: "Xb7hH8MSUJpSbSDYk0k2" },
  { id: "charlie", name: "Charlie", voiceId: "IKne3meq5aSn9XLyUdCD" },
  { id: "sarah", name: "Sarah", voiceId: "EXAVITQu4vr4xnSDxMaL" },
  { id: "george", name: "George", voiceId: "JBFqnCBsd6RMkjVDRZzb" },
  { id: "river", name: "River", voiceId: "SAz9YHcvj6GT2YYXdXww" },
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
