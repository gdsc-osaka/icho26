const BACKGROUND_URL = "/images/background.png";

let cached: Promise<HTMLImageElement> | null = null;

export function loadBackground(): Promise<HTMLImageElement> {
  if (cached) return cached;
  cached = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Reset on failure so a later call can retry instead of being
      // permanently stuck on the rejected promise.
      cached = null;
      reject(new Error(`Failed to load badge background (${BACKGROUND_URL})`));
    };
    img.src = BACKGROUND_URL;
  });
  return cached;
}
