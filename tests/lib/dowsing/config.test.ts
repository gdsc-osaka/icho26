import { describe, expect, it } from "vitest";
import {
  DEFAULT_DETECTION_METHOD,
  EMA_ALPHA,
  ENERGY_HALF_BINS,
  ENERGY_RANGE_MAX_DB,
  ENERGY_RANGE_MIN_DB,
  FFT_SIZE,
  FREQ_Q1_1_HZ,
  FREQ_Q1_2_HZ,
  PEAK_BAND_HALF_HZ,
  PEAK_RANGE_MAX_DB,
  PEAK_RANGE_MIN_DB,
  clamp,
} from "~/lib/dowsing/config";

describe("dowsing config sanity", () => {
  it("Q1-1 / Q1-2 frequencies are distinct and ultrasonic", () => {
    expect(FREQ_Q1_1_HZ).toBeGreaterThanOrEqual(15000);
    expect(FREQ_Q1_2_HZ).toBeGreaterThanOrEqual(15000);
    expect(FREQ_Q1_1_HZ).not.toBe(FREQ_Q1_2_HZ);
    // 両方式の帯域が重ならないこと。広い方（peak）が分離条件を満たせば、
    // 自動的に狭い方（energy_sum）も満たされる。
    const binHz = 48000 / FFT_SIZE;
    const peakHalfHz = PEAK_BAND_HALF_HZ;
    const energyHalfHz = ENERGY_HALF_BINS * binHz;
    const widerHalfHz = Math.max(peakHalfHz, energyHalfHz);
    expect(Math.abs(FREQ_Q1_2_HZ - FREQ_Q1_1_HZ)).toBeGreaterThan(
      widerHalfHz * 4,
    );
  });

  it("FFT size is a power of two", () => {
    expect(Math.log2(FFT_SIZE) % 1).toBe(0);
  });

  it("EMA alpha is within (0, 1)", () => {
    expect(EMA_ALPHA).toBeGreaterThan(0);
    expect(EMA_ALPHA).toBeLessThan(1);
  });

  it("peak / energy dB ranges are monotonically increasing", () => {
    expect(PEAK_RANGE_MAX_DB).toBeGreaterThan(PEAK_RANGE_MIN_DB);
    expect(ENERGY_RANGE_MAX_DB).toBeGreaterThan(ENERGY_RANGE_MIN_DB);
  });

  it("energy half-bins covers FFT spectral leakage width (>= 3 bins)", () => {
    // 連続正弦波は中心周辺 3〜5 bin にリークするため、リーク幅をカバーできる必要がある。
    expect(ENERGY_HALF_BINS).toBeGreaterThanOrEqual(3);
  });

  it("peak band half-width covers at least one bin at 48kHz / 8192", () => {
    const binHz = 48000 / FFT_SIZE;
    const halfBins = Math.round(PEAK_BAND_HALF_HZ / binHz);
    expect(halfBins).toBeGreaterThanOrEqual(1);
  });

  it("default detection method is pinned to 'peak'", () => {
    // 広帯域ノイズ耐性で実機検証した結果、peak を本番採用としたためここで固定。
    // 仕様変更で energy_sum に戻すなら本テストも更新すること。
    expect(DEFAULT_DETECTION_METHOD).toBe("peak");
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
