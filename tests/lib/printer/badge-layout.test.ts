import { describe, it, expect } from "vitest";
import { planBadge, BADGE_WIDTH } from "~/lib/printer/badge-layout";

describe("planBadge", () => {
  it("stacks sections in order with the requested gaps and padding", () => {
    const layout = planBadge({
      companyNameHeight: 32,
      groupNameHeight: 16,
      groupSizeHeight: 16,
      qrSize: 224,
      paddingTop: 16,
      paddingBottom: 24,
      gap: 12,
    });

    expect(layout.companyName).toEqual({ y: 16, height: 32 });
    expect(layout.groupName).toEqual({ y: 16 + 32 + 12, height: 16 });
    expect(layout.groupSize).toEqual({
      y: 16 + 32 + 12 + 16 + 12,
      height: 16,
    });
    expect(layout.qr).toEqual({
      y: 16 + 32 + 12 + 16 + 12 + 16 + 12,
      height: 224,
    });
    expect(layout.totalHeight).toBe(layout.qr.y + 224 + 24);
  });

  it("applies sensible defaults when padding/gap are omitted", () => {
    const layout = planBadge({
      companyNameHeight: 16,
      groupNameHeight: 16,
      groupSizeHeight: 16,
      qrSize: 100,
    });
    expect(layout.companyName.y).toBeGreaterThan(0);
    expect(layout.totalHeight).toBeGreaterThan(layout.qr.y + layout.qr.height);
  });

  it("exposes 384px as the canonical badge width", () => {
    expect(BADGE_WIDTH).toBe(384);
  });
});
