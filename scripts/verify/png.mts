import { crc32, deflateSync, inflateSync } from "node:zlib";

export type Image = { width: number; height: number; channels: 3 | 4; pixels: Buffer };
export type Rect = { x: number; y: number; width: number; height: number };

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS: Record<number, 3 | 4> = { 2: 3, 6: 4 };

const paeth = (left: number, up: number, upLeft: number) => {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
};

export function decodePng(file: Buffer): Image {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file");
  let offset = 8;
  let header: Buffer | null = null;
  const data: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("latin1", offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") header = body;
    if (type === "IDAT") data.push(body);
    if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!header) throw new Error("PNG has no IHDR chunk");
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const [bitDepth, colorType, , , interlace] = header.subarray(8, 13);
  const channels = CHANNELS[colorType];
  if (bitDepth !== 8 || !channels || interlace !== 0) throw new Error(`unsupported PNG: bit depth ${bitDepth}, color type ${colorType}, interlace ${interlace}`);
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    const at = row * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[at + i - channels] : 0;
      const up = row > 0 ? pixels[at - stride + i] : 0;
      const upLeft = row > 0 && i >= channels ? pixels[at - stride + i - channels] : 0;
      const predicted = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(left, up, upLeft) : -1;
      if (predicted < 0) throw new Error(`unknown PNG filter ${filter} on row ${row}`);
      pixels[at + i] = (line[i] + predicted) & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

const chunk = (type: string, body: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
};

export function encodePng({ width, height, channels, pixels }: Image): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, channels === 4 ? 6 : 2, 0, 0, 0], 8);
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export const MASK_COLOR = [255, 0, 255] as const;

export function fillRects(image: Image, rects: readonly Rect[], color: readonly [number, number, number] = MASK_COLOR) {
  for (const rect of rects) {
    const left = Math.max(0, Math.floor(rect.x));
    const top = Math.max(0, Math.floor(rect.y));
    const right = Math.min(image.width, Math.ceil(rect.x + rect.width));
    const bottom = Math.min(image.height, Math.ceil(rect.y + rect.height));
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const at = (y * image.width + x) * image.channels;
        image.pixels[at] = color[0];
        image.pixels[at + 1] = color[1];
        image.pixels[at + 2] = color[2];
        if (image.channels === 4) image.pixels[at + 3] = 255;
      }
    }
  }
  return image;
}

export function differingPixels(a: Image, b: Image) {
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) return Number.POSITIVE_INFINITY;
  let count = 0;
  for (let at = 0; at < a.pixels.length; at += a.channels) {
    for (let c = 0; c < a.channels; c++) {
      if (a.pixels[at + c] !== b.pixels[at + c]) {
        count++;
        break;
      }
    }
  }
  return count;
}

export function cropImage(image: Image, rect: Rect): Image {
  const left = Math.round(rect.x);
  const top = Math.round(rect.y);
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > image.width || top + height > image.height)
    throw new Error(`crop ${width}x${height} at ${left},${top} does not fit inside the ${image.width}x${image.height} screenshot`);
  const stride = width * image.channels;
  const pixels = Buffer.alloc(stride * height);
  for (let row = 0; row < height; row++) {
    const from = ((top + row) * image.width + left) * image.channels;
    image.pixels.copy(pixels, row * stride, from, from + stride);
  }
  return { width, height, channels: image.channels, pixels };
}

export function firstContentRow(image: Image, fromRow: number, threshold = 40) {
  for (let y = Math.max(0, Math.round(fromRow)); y < image.height; y++) {
    const row = y * image.width * image.channels;
    for (let x = 1; x < image.width; x++) {
      const at = row + x * image.channels;
      if ([0, 1, 2].some((c) => Math.abs(image.pixels[at + c] - image.pixels[row + c]) > threshold)) return y;
    }
  }
  return null;
}
