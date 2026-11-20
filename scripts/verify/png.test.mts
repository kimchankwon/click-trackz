import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { cropImage, decodePng, differingPixels, encodePng, fillRects, firstContentRow, MASK_COLOR, type Image } from "./png.mts";

const gradient = (width: number, height: number, channels: 3 | 4): Image => {
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37 + (i >> 3)) & 0xff;
  return { width, height, channels, pixels };
};

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

const chunk = (type: string, body: Buffer) => {
  const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
};

const encodeWithFilters = ({ width, height, channels, pixels }: Image) => {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    const filter = row % 5;
    raw[row * (stride + 1)] = filter;
    for (let i = 0; i < stride; i++) {
      const at = row * stride + i;
      const left = i >= channels ? pixels[at - channels] : 0;
      const up = row > 0 ? pixels[at - stride] : 0;
      const upLeft = row > 0 && i >= channels ? pixels[at - stride - channels] : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      raw[row * (stride + 1) + 1 + i] = (pixels[at] - predicted) & 0xff;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, channels === 4 ? 6 : 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

describe("png", () => {
  it("round trips RGB and RGBA images", () => {
    for (const channels of [3, 4] as const) {
      const image = gradient(7, 5, channels);
      expect(decodePng(encodePng(image))).toEqual(image);
    }
  });

  it("decodes every row filter", () => {
    for (const channels of [3, 4] as const) {
      const image = gradient(9, 10, channels);
      expect(differingPixels(decodePng(encodeWithFilters(image)), image)).toBe(0);
    }
  });

  it("rejects files it cannot read", () => {
    expect(() => decodePng(Buffer.from("not a png"))).toThrow(/not a PNG/);
  });

  it("fills rects clamped to the image and counts the pixels that changed", () => {
    const image = gradient(10, 10, 3);
    const before = { ...image, pixels: Buffer.from(image.pixels) };
    fillRects(image, [{ x: 8, y: -2, width: 5, height: 4 }]);
    expect(differingPixels(image, before)).toBe(4);
    expect([...image.pixels.subarray((1 * 10 + 9) * 3, (1 * 10 + 9) * 3 + 3)]).toEqual([...MASK_COLOR]);
  });

  it("crops a window and refuses one that does not fit", () => {
    const image = gradient(6, 4, 3);
    const cropped = cropImage(image, { x: 2, y: 1, width: 3, height: 2 });
    expect(cropped).toMatchObject({ width: 3, height: 2, channels: 3 });
    expect([...cropped.pixels.subarray(0, 3)]).toEqual([...image.pixels.subarray((1 * 6 + 2) * 3, (1 * 6 + 2) * 3 + 3)]);
    expect(() => cropImage(image, { x: 4, y: 0, width: 3, height: 2 })).toThrow(/does not fit/);
  });

  it("finds the first row that differs from its own left edge", () => {
    const image: Image = { width: 4, height: 5, channels: 3, pixels: Buffer.alloc(4 * 5 * 3, 240) };
    fillRects(image, [{ x: 2, y: 3, width: 1, height: 1 }], [10, 10, 10]);
    expect(firstContentRow(image, 0)).toBe(3);
    expect(firstContentRow(image, 4)).toBeNull();
  });

  it("treats images of different sizes as entirely different", () => {
    expect(differingPixels(gradient(2, 2, 3), gradient(3, 2, 3))).toBe(Number.POSITIVE_INFINITY);
  });
});
