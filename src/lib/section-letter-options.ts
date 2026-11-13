import { SECTION_LETTERS, type SectionLetter } from "@/sync/timeline";

export const LETTER_OPTIONS: readonly { value: SectionLetter | "none"; label: string }[] = [
  { value: "none", label: "None" },
  ...SECTION_LETTERS.map((letter) => ({ value: letter, label: letter })),
];
