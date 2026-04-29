// Match the spec used by Canvas's ctx.font and document.fonts.load:
// must include numeric weight (Medium = 500), size, and the family in
// double quotes.
const NOTO_SPEC = '500 28px "Noto Sans JP"';

let cached: Promise<void> | null = null;

/**
 * Wait until Noto Sans JP Medium is parsed and available for canvas
 * `fillText`. The Google Fonts <link> in root.tsx triggers the fetch;
 * this just blocks the badge renderer until the font face is ready so
 * the first print does not fall back to the default sans-serif.
 */
export function ensureNotoSansJp(): Promise<void> {
  if (cached) return cached;
  cached = (async () => {
    try {
      await document.fonts.load(NOTO_SPEC);
    } catch (err) {
      cached = null;
      throw err;
    }
  })();
  return cached;
}
