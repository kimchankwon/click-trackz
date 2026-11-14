export function pickPreviewPhrase<Key extends string>(keys: readonly Key[], previous: Key | null, random: () => number = Math.random): Key {
  const phrases = keys.filter((key) => !key.startsWith("count-"));
  const choices = phrases.length > 1 ? phrases.filter((key) => key !== previous) : phrases;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}
