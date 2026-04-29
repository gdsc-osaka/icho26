import { describe, expect, it } from "vitest";
import {
  BAND_HALF_HZ,
  EMA_ALPHA,
  FFT_SIZE,
  FREQ_Q1_1_HZ,
  FREQ_Q1_2_HZ,
  RANGE_MAX_DB,
  RANGE_MIN_DB,
  REF_FREQ_OFFSET_HZ,
  REF_GUARD_DB,
  REF_THRESHOLD_BOOST_DB,
  clamp,
} from "~/lib/dowsing/config";

describe("dowsing config sanity", () => {
  it("Q1-1 = 18600, Q1-2 = 20000 (ultrasonic, distinct)", () => {
    expect(FREQ_Q1_1_HZ).toBe(18600);
    expect(FREQ_Q1_2_HZ).toBe(20000);
  });

  it("Q1-1/Q1-2 帯域 (±BAND_HALF_HZ) が重ならないこと", () => {
    expect(Math.abs(FREQ_Q1_2_HZ - FREQ_Q1_1_HZ)).toBeGreaterThan(
      BAND_HALF_HZ * 2 * 2,
    );
  });

  it("reference band stays in ultrasonic (>= 18 kHz) for both targets", () => {
    expect(FREQ_Q1_1_HZ + REF_FREQ_OFFSET_HZ).toBeGreaterThanOrEqual(18000);
    expect(FREQ_Q1_2_HZ + REF_FREQ_OFFSET_HZ).toBeGreaterThanOrEqual(18000);
  });

  it("reference band does not collide with the other target's band", () => {
    const refQ11 = FREQ_Q1_1_HZ + REF_FREQ_OFFSET_HZ;
    const refQ12 = FREQ_Q1_2_HZ + REF_FREQ_OFFSET_HZ;
    expect(Math.abs(refQ11 - FREQ_Q1_2_HZ)).toBeGreaterThan(BAND_HALF_HZ * 2);
    expect(Math.abs(refQ12 - FREQ_Q1_1_HZ)).toBeGreaterThan(BAND_HALF_HZ * 2);
  });

  it("FFT size is a power of two", () => {
    expect(Math.log2(FFT_SIZE) % 1).toBe(0);
  });

  it("BAND_HALF_HZ resolves to >= 1 bin at 48kHz", () => {
    const binHz = 48000 / FFT_SIZE;
    expect(Math.round(BAND_HALF_HZ / binHz)).toBeGreaterThanOrEqual(1);
  });

  it("EMA alpha is within (0, 1)", () => {
    expect(EMA_ALPHA).toBeGreaterThan(0);
    expect(EMA_ALPHA).toBeLessThan(1);
  });

  it("dB proximity range is monotonically increasing and positive", () => {
    expect(RANGE_MIN_DB).toBeGreaterThan(0);
    expect(RANGE_MAX_DB).toBeGreaterThan(RANGE_MIN_DB);
  });

  it("reference guard / boost dB are positive", () => {
    expect(REF_GUARD_DB).toBeGreaterThan(0);
    expect(REF_THRESHOLD_BOOST_DB).toBeGreaterThan(0);
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
