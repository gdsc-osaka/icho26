import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, mapResult, flatMapResult } from "~/shared/result";

describe("Result", () => {
  it("ok() creates a successful result", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (r.ok) expect(r.value).toBe(42);
  });

  it("err() creates a failed result", () => {
    const r = err("fail");
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
    if (!r.ok) expect(r.error).toBe("fail");
  });

  it("mapResult transforms Ok and preserves Err", () => {
    expect(mapResult(ok(1), (n) => n + 1)).toEqual(ok(2));
    expect(mapResult(err<string>("e"), (n: number) => n + 1)).toEqual(err("e"));
  });

  it("flatMapResult chains Ok and short-circuits Err", () => {
    expect(flatMapResult(ok(1), (n) => ok(n * 2))).toEqual(ok(2));
    expect(flatMapResult(ok(1), (_n) => err("x"))).toEqual(err("x"));
    expect(flatMapResult(err<string>("e"), (n: number) => ok(n))).toEqual(err("e"));
  });
});
