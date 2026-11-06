export const MAX_COUNT_FONT = 124;

export const EM_PER_CHARACTER = { web: 0.7, ios: 0.72, android: 0.7 } as const;

export function countFontSize(label: string, textWidth: number, emPerCharacter: number): number {
  const characters = Math.max(1, label.length);
  return Math.min(MAX_COUNT_FONT, Math.floor(textWidth / (characters * emPerCharacter)));
}
