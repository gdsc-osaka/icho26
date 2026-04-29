import { BADGE_WIDTH } from "./badge-layout";

const BYTES_PER_ROW = BADGE_WIDTH / 8;
const LUMINANCE_THRESHOLD = 128;

/**
 * Pack an already-binary 384px-wide canvas into the raw 1-bpp byte layout
 * the LX-D02 expects.
 *
 * Going through `printer.print(canvas, ...)` makes the SDK run
 * Floyd-Steinberg dithering, which softens the BDF / QR / vector text we
 * already rendered as pure black-on-white. By thresholding ourselves we
 * preserve sharp glyph outlines for the vector (Noto Sans JP) name as
 * well as the bitmap-font lines.
 *
 * Bit layout matches `LXD02Printer.print(Uint8Array)`:
 * - 48 bytes per row (384 / 8)
 * - bit 7 (MSB) = leftmost pixel, bit 0 = rightmost
 * - 1 = black, 0 = white
 */
export function canvasToPackedBitmap(canvas: HTMLCanvasElement): Uint8Array {
  if (canvas.width !== BADGE_WIDTH) {
    throw new Error(
      `Expected canvas width ${BADGE_WIDTH}, got ${canvas.width}`,
    );
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D context for packing");

  const { width, height, data } = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const packed = new Uint8Array(height * BYTES_PER_ROW);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * BYTES_PER_ROW;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // ITU-R BT.601 luminance, matching the SDK's own grayscale step.
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (luma < LUMINANCE_THRESHOLD) {
        packed[rowOffset + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return packed;
}
