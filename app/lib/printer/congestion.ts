import { BADGE_WIDTH } from "./badge-layout";
import { canvasToPackedBitmap } from "./canvas-pack";

const CONGESTION_IMAGE_URL = "/images/congestion.png";

let cachedImage: Promise<HTMLImageElement> | null = null;
let cachedPacked: Promise<Uint8Array> | null = null;

function loadCongestionImage(): Promise<HTMLImageElement> {
  if (cachedImage) return cachedImage;
  cachedImage = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      cachedImage = null;
      reject(
        new Error(`Failed to load congestion image (${CONGESTION_IMAGE_URL})`),
      );
    };
    img.src = CONGESTION_IMAGE_URL;
  });
  return cachedImage;
}

/**
 * Load `/images/congestion.png` and pack it into the LX-D02's raw 1-bpp
 * byte layout. The PNG is already pure black/white at the printer's native
 * 384 px width, so handing the SDK the packed bytes directly avoids the
 * Floyd-Steinberg dithering that `printer.print(canvas)` would apply.
 */
export function loadCongestionPackedBitmap(): Promise<Uint8Array> {
  if (cachedPacked) return cachedPacked;
  cachedPacked = (async () => {
    const img = await loadCongestionImage();
    if (img.naturalWidth !== BADGE_WIDTH) {
      throw new Error(
        `Congestion image must be ${BADGE_WIDTH}px wide, got ${img.naturalWidth}px`,
      );
    }
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to acquire 2D context for congestion image");
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    return canvasToPackedBitmap(canvas);
  })().catch((err: unknown) => {
    cachedPacked = null;
    throw err;
  });
  return cachedPacked;
}
