import { describe, expect, it } from "vitest";
import {
  clearGroupIdCookie,
  getGroupIdFromRequest,
  setGroupIdCookie,
} from "~/lib/participant/session";

const VALID_GROUP_ID = "g_12345678-1234-1234-1234-123456789abc";

describe("getGroupIdFromRequest", () => {
  it("returns null when no Cookie header is present", () => {
    const request = new Request("http://localhost/");
    expect(getGroupIdFromRequest(request)).toBeNull();
  });

  it("returns null when the group_session cookie is absent", () => {
    const request = new Request("http://localhost/", {
      headers: { Cookie: "other=value" },
    });
    expect(getGroupIdFromRequest(request)).toBeNull();
  });

  it("returns null when the cookie value does not match the groupId pattern", () => {
    const request = new Request("http://localhost/", {
      headers: { Cookie: "group_session=not-a-group-id" },
    });
    expect(getGroupIdFromRequest(request)).toBeNull();
  });

  it("extracts the groupId when present alone", () => {
    const request = new Request("http://localhost/", {
      headers: { Cookie: `group_session=${VALID_GROUP_ID}` },
    });
    expect(getGroupIdFromRequest(request)).toBe(VALID_GROUP_ID);
  });

  it("extracts the groupId when interleaved with other cookies", () => {
    const request = new Request("http://localhost/", {
      headers: {
        Cookie: `first=1; group_session=${VALID_GROUP_ID}; last=2`,
      },
    });
    expect(getGroupIdFromRequest(request)).toBe(VALID_GROUP_ID);
  });

  it("decodes URL-encoded cookie values", () => {
    const request = new Request("http://localhost/", {
      headers: {
        Cookie: `group_session=${encodeURIComponent(VALID_GROUP_ID)}`,
      },
    });
    expect(getGroupIdFromRequest(request)).toBe(VALID_GROUP_ID);
  });
});

describe("setGroupIdCookie", () => {
  it("includes the required attributes with SameSite=Lax", () => {
    const cookie = setGroupIdCookie(VALID_GROUP_ID);
    expect(cookie).toContain(
      `group_session=${encodeURIComponent(VALID_GROUP_ID)}`,
    );
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    // QR-launched URLs are cross-site top-level navigations; SameSite=Lax
    // is required so the cookie survives the redirect from /start/:groupId
    // to the user's current stage on a re-scan.
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=86400");
  });
});

describe("clearGroupIdCookie", () => {
  it("expires the cookie with matching attributes", () => {
    const cookie = clearGroupIdCookie();
    expect(cookie).toContain("group_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });
});
