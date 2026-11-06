const SWITCH_DISTANCE = 64;
const SWITCH_VELOCITY = 600;

export function swipeStep(translationX: number, velocityX: number): -1 | 0 | 1 {
  if (translationX <= -SWITCH_DISTANCE || velocityX <= -SWITCH_VELOCITY) return 1;
  if (translationX >= SWITCH_DISTANCE || velocityX >= SWITCH_VELOCITY) return -1;
  return 0;
}
