type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export function preferPlaybackSession() {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session && session.type !== "playback") session.type = "playback";
}

export function setOwnsNowPlaying(_owns: boolean) {}

export async function probeAudioSession(): Promise<string | null> {
  return null;
}
