import { Font } from "bdfparser";

const UUIDEX_URL = "/fonts/b16-uuidex.bdf";
const DATETIME_URL = "/fonts/b24-datetime.bdf";

const cache = new Map<string, Promise<Font>>();

async function* iterLines(text: string): AsyncIterableIterator<string> {
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.codePointAt(i) === 10) {
      yield text.slice(start, i);
      start = i + 1;
    }
  }
  if (start < text.length) yield text.slice(start);
}

function loadFont(url: string): Promise<Font> {
  const cached = cache.get(url);
  if (cached) return cached;
  const promise = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch BDF font (${res.status}): ${url}`);
      }
      const text = await res.text();
      const font = new Font();
      await font.load_filelines(iterLines(text));
      return font;
    } catch (err) {
      // Reset on any failure so a later call can retry instead of being
      // permanently stuck on the rejected promise.
      cache.delete(url);
      throw err;
    }
  })();
  cache.set(url, promise);
  return promise;
}

/** Subset BDF (`0-9 a-g _ -`, 16px) used for the groupId line. */
export function loadFontUuidex(): Promise<Font> {
  return loadFont(UUIDEX_URL);
}

/** Subset BDF (digits, `/`, `:`, space, 24px) used for the date and party size. */
export function loadFontDateTime(): Promise<Font> {
  return loadFont(DATETIME_URL);
}
