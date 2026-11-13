export const OPTION_HEIGHT = 44;
const SCREEN_GUTTER = 16;
const MENU_GAP = 4;

export type Anchor = { x: number; y: number; width: number; height: number };

export function placeMenu(anchor: Anchor, screen: { width: number; height: number }, menu: { height: number; minWidth: number }) {
  const width = Math.min(Math.max(anchor.width, menu.minWidth), screen.width - SCREEN_GUTTER * 2);
  const left = Math.min(Math.max(anchor.x, SCREEN_GUTTER), screen.width - SCREEN_GUTTER - width);
  const below = screen.height - (anchor.y + anchor.height) - MENU_GAP - SCREEN_GUTTER;
  const above = anchor.y - MENU_GAP - SCREEN_GUTTER;
  const opensBelow = below >= menu.height || below >= above;
  const height = Math.max(OPTION_HEIGHT, Math.min(menu.height, opensBelow ? below : above));
  const top = opensBelow ? anchor.y + anchor.height + MENU_GAP : anchor.y - MENU_GAP - height;
  return { left, top, width, height };
}
