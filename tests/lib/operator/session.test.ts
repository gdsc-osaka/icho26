import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  computeSessionExpiry,
  generateSessionId,
  getSessionIdFromRequest,
  setSessionCookie,
} from "~/lib/operator/session";

describe("getSessionIdFromRequest", () => {
  it("returns null when no Cookie header is present", () => {
    const request = new Request("http://localhost/");
    expect(getSessionIdFromRequest(request)).toBeNull();
  });

  it("returns null when the operator_session cookie is absent", () => {
    const request = new Request("http://localhost/", {
      headers: { Cookie: "other=value" },
    });
    expect(getSessionIdFromRequest(request)).toBeNull();
  });

  it("extracts the session id when present alone", () => {
    const request = new Request("http://localhost/", {
      headers: { Cookie: "operator_session=abc123" },
    });
    expect(getSessionIdFromRequest(request)).toBe("abc123");
  });

  it("extracts the session id when interleaved with other cookies", () => {
    const request = new Request("http://localhost/", {
      headers: { Cookie: "first=1; operator_session=abc123; last=2" },
    });
    expect(getSessionIdFromRequest(request)).toBe("abc123");
  });
});

describe("setSessionCookie", () => {
  it("includes the required security attributes", () => {
    const cookie = setSessionCookie("session-xyz");
    expect(cookie).toContain("operator_session=session-xyz");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toMatch(/Max-Age=\d+/);
  });
});

describe("clearSessionCookie", () => {
  it("sets Max-Age to 0", () => {
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });
});

describe("computeSessionExpiry", () => {
  it("adds 12 hours to the given timestamp", () => {
    const now = new Date("2026-04-29T00:00:00.000Z");
    expect(computeSessionExpiry(now)).toBe("2026-04-29T12:00:00.000Z");
  });
});

describe("generateSessionId", () => {
  it("returns a base64url-encoded value", () => {
    expect(generateSessionId()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns unique values across calls", () => {
    expect(generateSessionId()).not.toBe(generateSessionId());
  });
});
