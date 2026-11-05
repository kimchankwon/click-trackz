export const builtinSectionTypes = [
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Post-Chorus",
  "Bridge",
  "Interlude",
  "Turnaround",
  "Instrumental",
  "Solo",
  "Tag",
  "Vamp",
  "Breakdown",
  "Build",
  "Outro",
  "Ending",
] as const;

export const isBuiltinSectionType = (value: string) => (builtinSectionTypes as readonly string[]).includes(value);
