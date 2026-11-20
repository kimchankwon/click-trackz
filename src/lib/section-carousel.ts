const SIDE_FONT = 14;
const SIDE_DROP = -4;

export const sideScaleFor = (fontSize: number) => SIDE_FONT / fontSize;

export function carouselSlot(position: number, width: number, sideWidth: number, sideScale: number) {
  "worklet";
  const distance = Math.abs(position);
  const near = Math.min(1, distance);
  const reach = width / 2 - sideWidth / 2;
  return {
    centreX: width / 2 + position * reach,
    scale: 1 - (1 - sideScale) * near,
    drop: near * SIDE_DROP + 0,
    opacity: distance <= 1 ? 1 : Math.max(0, 2 - distance),
  };
}
