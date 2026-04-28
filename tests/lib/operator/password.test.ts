import { describe, expect, it } from "vitest";
import {
  generateSalt,
  hashPassword,
  verifyPassword,
} from "~/lib/operator/password";

const TEST_ITERATIONS = 1000;

describe("password", () => {
  it("verifyPassword returns true for the correct password", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("hunter2", salt, TEST_ITERATIONS);
    expect(await verifyPassword("hunter2", hash, salt, TEST_ITERATIONS)).toBe(
      true,
    );
  });

  it("verifyPassword returns false for the wrong password", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("hunter2", salt, TEST_ITERATIONS);
    expect(await verifyPassword("hunter3", hash, salt, TEST_ITERATIONS)).toBe(
      false,
    );
  });

  it("hashPassword is deterministic for a given salt and iterations", async () => {
    const salt = generateSalt();
    const a = await hashPassword("same", salt, TEST_ITERATIONS);
    const b = await hashPassword("same", salt, TEST_ITERATIONS);
    expect(a).toBe(b);
  });

  it("different salts produce different hashes for the same password", async () => {
    const saltA = generateSalt();
    const saltB = generateSalt();
    const hashA = await hashPassword("same", saltA, TEST_ITERATIONS);
    const hashB = await hashPassword("same", saltB, TEST_ITERATIONS);
    expect(hashA).not.toBe(hashB);
  });

  it("generateSalt returns a base64-encoded value of 16 bytes", () => {
    const salt = generateSalt();
    const decoded = atob(salt);
    expect(decoded.length).toBe(16);
  });
});
