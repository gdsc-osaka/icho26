import { describe, it, expect } from "vitest";
import {
  BADGE_HEIGHT,
  BADGE_LAYOUT,
  BADGE_WIDTH,
} from "~/lib/printer/badge-layout";
import { formatYmdHms } from "~/lib/printer/badge-renderer";

describe("BADGE_LAYOUT constants", () => {
  it("matches the printable area finalized by the design", () => {
    expect(BADGE_WIDTH).toBe(384);
    expect(BADGE_HEIGHT).toBe(600);
    expect(BADGE_LAYOUT.name).toEqual({
      centerX: 192,
      topY: 136,
      fontSizes: [28, 24, 20],
      horizontalPadding: 12,
    });
    expect(BADGE_LAYOUT.qr).toEqual({
      centerX: 192,
      centerY: 324,
      maxSize: 232,
    });
    expect(BADGE_LAYOUT.groupSize).toEqual({ centerX: 60, topY: 492 });
    expect(BADGE_LAYOUT.issuedAt).toEqual({ leftX: 126, topY: 492 });
    expect(BADGE_LAYOUT.groupId).toEqual({ leftX: 48, topY: 548 });
  });
});

describe("formatYmdHms", () => {
  it("zero-pads month, day, hour, minute, second", () => {
    expect(formatYmdHms(new Date(2026, 0, 1, 0, 0, 0))).toBe(
      "2026/01/01 00:00:00",
    );
  });

  it("renders a typical timestamp using local time", () => {
    expect(formatYmdHms(new Date(2026, 3, 30, 14, 23, 45))).toBe(
      "2026/04/30 14:23:45",
    );
  });

  it("does not pad the year", () => {
    expect(formatYmdHms(new Date(2099, 11, 31, 23, 59, 59))).toBe(
      "2099/12/31 23:59:59",
    );
  });

  it("produces a fixed-length 19-char string for any 4-digit year", () => {
    const out = formatYmdHms(new Date(2026, 6, 7, 8, 9, 10));
    expect(out).toBe("2026/07/07 08:09:10");
    expect(out).toHaveLength(19);
  });
});
