import { describe, it, expect } from "vitest";
import {
  RESERVATION_SLOT_MINUTES,
  computeEstimatedStartAt,
} from "~/lib/operator/reservations";

const MS_PER_MIN = 60_000;

describe("computeEstimatedStartAt", () => {
  it("returns reservedAt for the front of the queue when reserved time is in the past", () => {
    const reserved = "2026-05-01T10:00:00.000Z";
    const now = "2026-05-01T10:05:00.000Z";
    // position 1 → offset 0; clamped to now since reserved + 0 < now.
    expect(computeEstimatedStartAt(reserved, 1, now)).toBe(now);
  });

  it("uses reserved + (position-1) * slot when that time is in the future", () => {
    const reserved = "2026-05-01T10:00:00.000Z";
    const now = "2026-05-01T10:00:00.000Z";
    const expected = new Date(
      Date.parse(reserved) + 2 * RESERVATION_SLOT_MINUTES * MS_PER_MIN,
    ).toISOString();
    expect(computeEstimatedStartAt(reserved, 3, now)).toBe(expected);
  });

  it("clamps to now even for later positions if every prior slot has passed", () => {
    const reserved = "2026-05-01T09:00:00.000Z";
    // 90 minutes after reserved; positions 1..9 (each 10min) all already passed.
    const now = "2026-05-01T10:30:00.000Z";
    expect(computeEstimatedStartAt(reserved, 5, now)).toBe(now);
  });

  it("respects a custom slot duration", () => {
    const reserved = "2026-05-01T10:00:00.000Z";
    const now = "2026-05-01T10:00:00.000Z";
    const slot = 5;
    const expected = new Date(
      Date.parse(reserved) + 2 * slot * MS_PER_MIN,
    ).toISOString();
    expect(computeEstimatedStartAt(reserved, 3, now, slot)).toBe(expected);
  });

  it("treats position <= 0 as front of queue (no offset)", () => {
    const reserved = "2026-05-01T10:00:00.000Z";
    const now = "2026-05-01T09:55:00.000Z";
    // reserved is 5min in the future; offset is 0; result = reserved.
    expect(computeEstimatedStartAt(reserved, 0, now)).toBe(reserved);
  });
});
