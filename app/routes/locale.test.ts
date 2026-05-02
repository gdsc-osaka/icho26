import { describe, expect, it } from "vitest";
import { action } from "./locale";

function makeArgs(formData: FormData, referer?: string) {
  const headers = new Headers();
  if (referer) headers.set("Referer", referer);
  const request = new Request("https://example.com/locale", {
    method: "POST",
    headers,
    body: formData,
  });
  return {
    request,
    params: {},
    context: {} as never,
  };
}

describe("locale action", () => {
  it("sets the locale cookie and redirects to the referer path", async () => {
    const fd = new FormData();
    fd.set("locale", "en");
    const result = await action(
      makeArgs(fd, "https://example.com/q1?from=hub") as never,
    );
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("Location")).toBe("/q1?from=hub");
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("locale=en");
    expect(setCookie).toContain("Path=/");
  });

  it("redirects to '/' when referer is missing", async () => {
    const fd = new FormData();
    fd.set("locale", "ja");
    const result = await action(makeArgs(fd) as never);
    const res = result as Response;
    expect(res.headers.get("Location")).toBe("/");
  });

  it("rejects unsupported locale values with 400", async () => {
    const fd = new FormData();
    fd.set("locale", "fr");
    await expect(action(makeArgs(fd) as never)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("ignores cross-origin referer and redirects to '/'", async () => {
    const fd = new FormData();
    fd.set("locale", "en");
    const result = await action(
      makeArgs(fd, "https://attacker.example/path") as never,
    );
    const res = result as Response;
    expect(res.headers.get("Location")).toBe("/");
  });
});
