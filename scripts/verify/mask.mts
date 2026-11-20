import type { Rect } from "./png.mts";

export type MaskEntry = string | { testId: string; x?: number; width?: number };
export type CropEntry = { text: string; top: number; height: number };
export type HierarchyNode = { attributes?: Record<string, string>; children?: HierarchyNode[] };

export const maskTestId = (entry: MaskEntry) => (typeof entry === "string" ? entry : entry.testId);

export function shapeMask(entry: MaskEntry, element: Rect, screenWidth: number): Rect {
  if (typeof entry === "string") return element;
  const x = entry.x === undefined ? element.x : entry.x < 0 ? screenWidth + entry.x : entry.x;
  return { x, y: element.y, width: entry.width ?? element.width, height: element.height };
}

export const scaleRect = (rect: Rect, scale: number): Rect => ({ x: rect.x * scale, y: rect.y * scale, width: rect.width * scale, height: rect.height * scale });

const BOUNDS = /^\[(-?[\d.]+),(-?[\d.]+)\]\[(-?[\d.]+),(-?[\d.]+)\]$/;

const parseBounds = (bounds: string | undefined): Rect | null => {
  const match = bounds ? BOUNDS.exec(bounds) : null;
  if (!match) return null;
  const [x1, y1, x2, y2] = match.slice(1).map(Number);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

function* walk(node: HierarchyNode): Generator<HierarchyNode> {
  yield node;
  for (const child of node.children ?? []) yield* walk(child);
}

export function screenPoints(tree: HierarchyNode) {
  let width = 0;
  for (const node of walk(tree)) {
    const rect = parseBounds(node.attributes?.bounds);
    if (rect) width = Math.max(width, rect.x + rect.width);
  }
  return width;
}

export function maskRects(tree: HierarchyNode, entries: readonly MaskEntry[], imageWidth: number) {
  let screenWidth = 0;
  const found = new Map<string, Rect[]>();
  const wanted = new Set(entries.map(maskTestId));
  for (const node of walk(tree)) {
    const rect = parseBounds(node.attributes?.bounds);
    if (!rect) continue;
    screenWidth = Math.max(screenWidth, rect.x + rect.width);
    const id = node.attributes?.["resource-id"];
    if (id && wanted.has(id) && rect.width > 0 && rect.height > 0) found.set(id, [...(found.get(id) ?? []), rect]);
  }
  const missing = entries.map(maskTestId).filter((id) => !found.has(id));
  if (screenWidth === 0) return { rects: [], missing };
  const scale = imageWidth / screenWidth;
  const rects = entries.flatMap((entry) => (found.get(maskTestId(entry)) ?? []).map((rect) => scaleRect(shapeMask(entry, rect, screenWidth), scale)));
  return { rects, missing };
}

export function cropRect(tree: HierarchyNode, crop: CropEntry, imageWidth: number): Rect | null {
  let screenWidth = 0;
  let anchor: Rect | null = null;
  for (const node of walk(tree)) {
    const rect = parseBounds(node.attributes?.bounds);
    if (!rect) continue;
    screenWidth = Math.max(screenWidth, rect.x + rect.width);
    const label = (node.attributes?.text || node.attributes?.accessibilityText || "").trim();
    if (!anchor && label === crop.text && rect.height > 0) anchor = rect;
  }
  if (!anchor || screenWidth === 0) return null;
  return scaleRect({ x: 0, y: anchor.y + crop.top, width: screenWidth, height: crop.height }, imageWidth / screenWidth);
}
