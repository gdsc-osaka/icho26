import { describe, expect, it } from "vitest";
import {
  attenuateBySpike,
  bandEnergyMagnitude,
  dbToMagnitude,
  magnitudeRatioToProximity,
  median,
  refSpikeDb,
} from "~/lib/dowsing/signal-math";

describe("dbToMagnitude", () => {
  it("0 dB => 1.0", () => {
    expect(dbToMagnitude(0)).toBeCloseTo(1, 9);
  });
  it("-20 dB => 0.1", () => {
    expect(dbToMagnitude(-20)).toBeCloseTo(0.1, 9);
  });
  it("20 dB => 10", () => {
    expect(dbToMagnitude(20)).toBeCloseTo(10, 9);
  });
  it("monotonic increasing", () => {
    expect(dbToMagnitude(-30)).toBeLessThan(dbToMagnitude(-29));
    expect(dbToMagnitude(0)).toBeLessThan(dbToMagnitude(1));
  });
});

describe("bandEnergyMagnitude", () => {
  it("sums dB-converted magnitudes within [lo, hi]", () => {
    const buf = new Float32Array([
      0, // bin 0  => 1.0
      -20, // bin 1  => 0.1
      -40, // bin 2  => 0.01
      -60, // bin 3  => 0.001
    ]);
    expect(bandEnergyMagnitude(buf, 1, 2)).toBeCloseTo(0.1 + 0.01, 9);
  });

  it("ignores -Infinity", () => {
    const buf = new Float32Array([-Infinity, -20, 0]);
    expect(bandEnergyMagnitude(buf, 0, 2)).toBeCloseTo(0.1 + 1.0, 9);
  });

  it("clamps to buffer bounds", () => {
    const buf = new Float32Array([0, 0, 0]);
    // hi 越え/lo マイナスでも例外を出さず、可能な範囲だけ合計
    expect(bandEnergyMagnitude(buf, -5, 100)).toBeCloseTo(3, 9);
  });

  it("returns 0 for empty range", () => {
    const buf = new Float32Array([0, 0, 0]);
    expect(bandEnergyMagnitude(buf, 5, 1)).toBe(0);
  });
});

describe("refSpikeDb", () => {
  it("returns 0 when refNoiseMag is 0", () => {
    expect(refSpikeDb(1, 0)).toBe(0);
  });
  it("returns 0 when refNoiseMag is negative", () => {
    expect(refSpikeDb(1, -1)).toBe(0);
  });
  it("ratio 1 => 0 dB", () => {
    expect(refSpikeDb(2, 2)).toBeCloseTo(0, 9);
  });
  it("ratio 2 => ~6.02 dB", () => {
    expect(refSpikeDb(2, 1)).toBeCloseTo(6.0206, 3);
  });
  it("ratio 10 => 20 dB", () => {
    expect(refSpikeDb(10, 1)).toBeCloseTo(20, 9);
  });
});

describe("attenuateBySpike", () => {
  it("returns sigMag unchanged when spike <= guardDb", () => {
    expect(attenuateBySpike(0.5, 0.1, 5, 9, 6)).toBe(0.5);
    expect(attenuateBySpike(0.5, 0.1, 9, 9, 6)).toBe(0.5);
  });

  it("subtracts noiseMag * 10^(boostDb/20) when spike > guardDb", () => {
    // boost 6 dB => factor ~1.995
    const sigMag = 1.0;
    const noiseMag = 0.1;
    const result = attenuateBySpike(sigMag, noiseMag, 12, 9, 6);
    expect(result).toBeCloseTo(1.0 - 0.1 * dbToMagnitude(6), 6);
  });

  it("clamps to 0 when subtraction would go negative", () => {
    const result = attenuateBySpike(0.05, 1.0, 20, 9, 6);
    expect(result).toBe(0);
  });
});

describe("magnitudeRatioToProximity", () => {
  it("returns 0 when noiseMag is 0", () => {
    expect(magnitudeRatioToProximity(1, 0, 3, 30)).toBe(0);
  });
  it("returns 0 when targetMag is 0", () => {
    expect(magnitudeRatioToProximity(0, 1, 3, 30)).toBe(0);
  });
  it("returns 0 when ratio in dB is below rangeMin", () => {
    // ratio 1 => 0 dB, < 3 dB
    expect(magnitudeRatioToProximity(1, 1, 3, 30)).toBe(0);
  });
  it("returns 1 when ratio in dB is above rangeMax", () => {
    // ratio 1000 => 60 dB, > 30 dB
    expect(magnitudeRatioToProximity(1000, 1, 3, 30)).toBe(1);
  });
  it("maps midpoint linearly between rangeMin and rangeMax", () => {
    // midpoint of [3, 30] dB is 16.5 dB => ratio = 10^(16.5/20) ≈ 6.6834
    const t = magnitudeRatioToProximity(6.6834, 1, 3, 30);
    expect(t).toBeCloseTo(0.5, 2);
  });
  it("returns 0 when range is invalid (max <= min)", () => {
    expect(magnitudeRatioToProximity(10, 1, 30, 30)).toBe(0);
    expect(magnitudeRatioToProximity(10, 1, 30, 3)).toBe(0);
  });
});

describe("median", () => {
  it("returns middle of sorted values", () => {
    expect(median([3, 1, 2], 0)).toBe(2);
    expect(median([5, 1, 4, 2, 3], 0)).toBe(3);
  });
  it("returns fallback for empty array", () => {
    expect(median([], 42)).toBe(42);
  });
  it("does not mutate input", () => {
    const arr = [3, 1, 2];
    median(arr, 0);
    expect(arr).toEqual([3, 1, 2]);
  });
});
