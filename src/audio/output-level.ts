export const OUTPUT_BOOST = 1.3;
export const LIMITER_RANGE = 1.5;
const KNEE = 0.8;

export const softLimit = (level: number) => {
  const magnitude = Math.abs(level);
  if (magnitude <= KNEE) return level;
  return Math.sign(level) * (KNEE + (1 - KNEE) * Math.tanh((magnitude - KNEE) / (1 - KNEE)));
};

export function limiterCurve(points = 2049): Float32Array {
  const curve = new Float32Array(points);
  for (let index = 0; index < points; index++) curve[index] = softLimit(((index / (points - 1)) * 2 - 1) * LIMITER_RANGE);
  return curve;
}
