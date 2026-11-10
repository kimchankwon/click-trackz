type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export function preferPlaybackSession() {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session && session.type !== "playback") session.type = "playback";
}

export function setOwnsNowPlaying(_owns: boolean, _options: { applyNow?: boolean } = {}) {}

export function onInterruptionEnded(_handler: (shouldResume: boolean) => void): () => void {
  return () => undefined;
}

export async function probeAudioSession(): Promise<string | null> {
  return null;
}
