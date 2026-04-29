import { Font } from "bdfparser";

const FONT_URL = "/fonts/b16.bdf";

let cached: Promise<Font> | null = null;

async function* iterLines(text: string): AsyncIterableIterator<string> {
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      yield text.slice(start, i);
      start = i + 1;
    }
  }
  if (start < text.length) yield text.slice(start);
}

export function loadBdfFont(): Promise<Font> {
  if (cached) return cached;
  cached = (async () => {
    const res = await fetch(FONT_URL);
    if (!res.ok) {
      cached = null;
      throw new Error(`Failed to fetch BDF font (${res.status})`);
    }
    const text = await res.text();
    const font = new Font();
    await font.load_filelines(iterLines(text));
    return font;
  })();
  return cached;
}
