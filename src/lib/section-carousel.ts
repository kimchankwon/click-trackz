const SIDE_FONT = 14;
const SIDE_DROP = -4;
const SIDE_MARGIN = 4;

export function sideScaleFor(fontSize: number, titleWidth: number, sideWidth: number) {
  const readable = SIDE_FONT / fontSize;
  if (titleWidth <= 0) return readable;
  return Math.min(readable, Math.max(0, sideWidth - SIDE_MARGIN) / titleWidth);
}

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
