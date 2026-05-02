import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale";

const LOCALE_COOKIE = "locale";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function getLocale(request: Request): Locale {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return DEFAULT_LOCALE;
  for (const part of cookie.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== LOCALE_COOKIE) continue;
    const value = decodeURIComponent(part.slice(eq + 1).trim());
    if (isLocale(value)) return value;
  }
  return DEFAULT_LOCALE;
}

export function setLocaleCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
