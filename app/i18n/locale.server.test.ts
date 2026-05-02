import { describe, expect, it } from "vitest";
import { getLocale, setLocaleCookie } from "./locale.server";

function makeRequest(cookie?: string): Request {
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  return new Request("https://example.com/", { headers });
}

describe("getLocale", () => {
  it("returns default ja when no Cookie header is present", () => {
    expect(getLocale(makeRequest())).toBe("ja");
  });

  it("returns default ja when locale cookie is missing", () => {
    expect(getLocale(makeRequest("session=abc; theme=dark"))).toBe("ja");
  });

  it("returns en when locale cookie is set to en", () => {
    expect(getLocale(makeRequest("locale=en"))).toBe("en");
  });

  it("returns ja when locale cookie is set to ja among other cookies", () => {
    expect(getLocale(makeRequest("session=abc; locale=ja; foo=bar"))).toBe(
      "ja",
    );
  });

  it("falls back to default when locale cookie has an unsupported value", () => {
    expect(getLocale(makeRequest("locale=fr"))).toBe("ja");
  });

  it("decodes percent-encoded values before validating", () => {
    expect(getLocale(makeRequest("locale=%65%6e"))).toBe("en");
  });
});

describe("setLocaleCookie", () => {
  it("emits a Set-Cookie string with Path, Max-Age, and SameSite", () => {
    const cookie = setLocaleCookie("en");
    expect(cookie).toContain("locale=en");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toMatch(/Max-Age=\d+/);
  });

  it("round-trips through getLocale", () => {
    const cookie = setLocaleCookie("en");
    const cookieValue = cookie.split(";")[0];
    expect(getLocale(makeRequest(cookieValue))).toBe("en");
  });
});
