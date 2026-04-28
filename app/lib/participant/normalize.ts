/**
 * Normalize raw user input for answer comparison.
 *
 * Rules (per spec 03 §4.1):
 *   1. Trim leading/trailing whitespace
 *   2. Convert full-width digits and ASCII letters to half-width
 *   3. Lowercase ASCII letters
 *   4. Strip leading zeros from pure-digit strings (`029` → `29`, `0` stays `0`)
 */
export function normalize(input: string): string {
  // 1. trim
  let s = input.trim();

  // 2. full-width → half-width for digits (０-９) and letters (Ａ-Ｚ, ａ-ｚ)
  s = s.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );

  // 3. lowercase
  s = s.toLowerCase();

  // 4. strip leading zeros if the entire string is digits (preserve "0")
  if (/^\d+$/.test(s)) {
    s = s.replace(/^0+(\d)/, "$1");
  }

  return s;
}
