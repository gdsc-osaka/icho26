import { describe, it, expect } from "vitest";
import { getOrCreateRequestId } from "~/shared/context/request-id";

describe("getOrCreateRequestId", () => {
  it("generates a new UUID when header is absent", () => {
    const req = new Request("https://example.com");
    const id = getOrCreateRequestId(req);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns the valid header value when present", () => {
    const req = new Request("https://example.com", {
      headers: { "x-request-id": "abc_123-456" },
    });
    expect(getOrCreateRequestId(req)).toBe("abc_123-456");
  });

  it("rejects invalid header values (contains spaces) and generates a new one", () => {
    const req = new Request("https://example.com", {
      headers: { "x-request-id": "bad id" },
    });
    const id = getOrCreateRequestId(req);
    expect(id).not.toBe("bad id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects empty header value and generates a new one", () => {
    const req = new Request("https://example.com", {
      headers: { "x-request-id": "" },
    });
    const id = getOrCreateRequestId(req);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
