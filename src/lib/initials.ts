export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return "?";
  const firstLetter = (word: string) => Array.from(word)[0].toUpperCase();
  const first = firstLetter(words[0]);
  return words.length === 1 ? first : first + firstLetter(words[words.length - 1]);
}
