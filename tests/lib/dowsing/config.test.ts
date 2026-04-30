import { describe, expect, it } from "vitest";
import {
  EMA_ALPHA,
  ENERGY_HALF_BINS,
  FFT_SIZE,
  FREQ_Q1_1_HZ,
  FREQ_Q1_2_HZ,
  RANGE_MAX_DB,
  RANGE_MIN_DB,
  clamp,
} from "~/lib/dowsing/config";

describe("dowsing config sanity", () => {
  it("Q1-1 / Q1-2 frequencies are distinct and ultrasonic", () => {
    expect(FREQ_Q1_1_HZ).toBeGreaterThanOrEqual(15000);
    expect(FREQ_Q1_2_HZ).toBeGreaterThanOrEqual(15000);
    expect(FREQ_Q1_1_HZ).not.toBe(FREQ_Q1_2_HZ);
    // 帯域が重ならないこと（合計帯域 ±ENERGY_HALF_BINS × bin幅 の 4 倍以上の分離）
    const binHz = 48000 / FFT_SIZE;
    const bandHalfHz = ENERGY_HALF_BINS * binHz;
    expect(Math.abs(FREQ_Q1_2_HZ - FREQ_Q1_1_HZ)).toBeGreaterThan(
      bandHalfHz * 4,
    );
  });

  it("FFT size is a power of two", () => {
    expect(Math.log2(FFT_SIZE) % 1).toBe(0);
  });

  it("EMA alpha is within (0, 1)", () => {
    expect(EMA_ALPHA).toBeGreaterThan(0);
    expect(EMA_ALPHA).toBeLessThan(1);
  });

  it("dB range is monotonically increasing", () => {
    expect(RANGE_MAX_DB).toBeGreaterThan(RANGE_MIN_DB);
  });

  it("energy half-bins covers FFT spectral leakage width (>= 3 bins)", () => {
    // 連続正弦波は中心周辺 3〜5 bin にリークするため、リーク幅をカバーできる必要がある。
    expect(ENERGY_HALF_BINS).toBeGreaterThanOrEqual(3);
  });
});

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });
  it("clamps above max", () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });
  it("passes through in-range", () => {
    expect(clamp(42, 0, 100)).toBe(42);
  });
});
