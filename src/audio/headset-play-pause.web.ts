export function setHeadsetPlayPause(_enabled: boolean) {}

export function onHeadsetPlayPause(_listener: () => void): () => void {
  return () => undefined;
}
