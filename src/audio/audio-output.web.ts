export type AudioOutput = { id: string; name: string };

export function currentAudioOutput(): AudioOutput | null {
  return null;
}

export function onAudioOutputChange(_listener: () => void): () => void {
  return () => undefined;
}
