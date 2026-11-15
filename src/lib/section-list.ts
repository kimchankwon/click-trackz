export const SECTION_ROW_HEIGHT = 40;
export const SECTION_ROW_GAP = 4;
export const VISIBLE_SECTION_ROWS = 5;

const STEP = SECTION_ROW_HEIGHT + SECTION_ROW_GAP;

export const sectionListHeight = (rows: number) => {
  const shown = Math.max(1, Math.min(VISIBLE_SECTION_ROWS, rows));
  return shown * SECTION_ROW_HEIGHT + (shown - 1) * SECTION_ROW_GAP;
};

export function centredScrollY(focus: number, viewHeight: number, rows: number): number {
  const contentHeight = rows * SECTION_ROW_HEIGHT + Math.max(0, rows - 1) * SECTION_ROW_GAP;
  const wanted = focus * STEP + SECTION_ROW_HEIGHT / 2 - viewHeight / 2;
  return Math.max(0, Math.min(Math.max(0, contentHeight - viewHeight), wanted));
}
