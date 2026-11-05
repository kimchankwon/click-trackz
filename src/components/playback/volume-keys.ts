export const VOLUME_STEP = 0.1;

export const clampVolume = (value: number) => Math.min(1, Math.max(0, value));

export function volumeForKey(value: number, key: string): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return clampVolume(value + VOLUME_STEP);
    case "ArrowLeft":
    case "ArrowDown":
      return clampVolume(value - VOLUME_STEP);
    case "Home":
      return 0;
    case "End":
      return 1;
    default:
      return null;
  }
}
