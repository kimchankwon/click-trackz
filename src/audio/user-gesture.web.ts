const GESTURES = ["touchend", "click", "keydown"] as const;

export function onUserGesture(listener: () => void): () => void {
  GESTURES.forEach((name) => document.addEventListener(name, listener, true));
  return () => GESTURES.forEach((name) => document.removeEventListener(name, listener, true));
}
