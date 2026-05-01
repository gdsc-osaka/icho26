import { describe, it, expect } from "vitest";
import { CONGESTION_CAPACITY, buildCongestionSnapshot } from "~/lib/congestion";

describe("buildCongestionSnapshot", () => {
  it("returns 0 rate when no participants are active", () => {
    expect(buildCongestionSnapshot(0)).toEqual({
      activeParticipants: 0,
      capacity: CONGESTION_CAPACITY,
      rate: 0,
      overCapacity: false,
    });
  });

  it("computes proportional rate below capacity", () => {
    const snap = buildCongestionSnapshot(15);
    expect(snap.activeParticipants).toBe(15);
    expect(snap.rate).toBe(15 / CONGESTION_CAPACITY);
    expect(snap.overCapacity).toBe(false);
  });

  it("returns rate of 1 exactly at capacity", () => {
    const snap = buildCongestionSnapshot(CONGESTION_CAPACITY);
    expect(snap.rate).toBe(1);
    expect(snap.overCapacity).toBe(false);
  });

  it("caps rate at 1 and flags overCapacity when exceeded", () => {
    const snap = buildCongestionSnapshot(CONGESTION_CAPACITY + 5);
    expect(snap.activeParticipants).toBe(CONGESTION_CAPACITY + 5);
    expect(snap.rate).toBe(1);
    expect(snap.overCapacity).toBe(true);
  });

  it("clamps negative input to 0", () => {
    const snap = buildCongestionSnapshot(-3);
    expect(snap.activeParticipants).toBe(0);
    expect(snap.rate).toBe(0);
    expect(snap.overCapacity).toBe(false);
  });

  it("honours a custom capacity", () => {
    const snap = buildCongestionSnapshot(5, 10);
    expect(snap.capacity).toBe(10);
    expect(snap.rate).toBe(0.5);
  });

  it("treats zero capacity as 0 rate (no division by zero)", () => {
    const snap = buildCongestionSnapshot(5, 0);
    expect(snap.rate).toBe(0);
    expect(snap.overCapacity).toBe(true);
  });
});
