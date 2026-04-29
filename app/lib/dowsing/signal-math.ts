/**
 * ダウジング信号処理の純粋関数。AnalyserNode から取得した dB スペクトルを
 * 線形 magnitude に変換し、狭帯域エネルギー合計と参照帯域による誤検知抑制を行う。
 *
 * すべてサイドエフェクトなし・引数のみに依存。テスト容易性のため hook から分離。
 */

/** dB (decibel, 振幅スケール) を線形 magnitude に変換: 10^(dB/20) */
export function dbToMagnitude(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * `[lo, hi]` (両端含む) の bin の dB 値を線形 magnitude に変換して合計する。
 * 範囲外・undefined・非有限値は無視する。
 */
export function bandEnergyMagnitude(
  buf: Float32Array,
  lo: number,
  hi: number,
): number {
  let sum = 0;
  const start = Math.max(0, lo);
  const end = Math.min(buf.length - 1, hi);
  for (let i = start; i <= end; i++) {
    const v = buf[i];
    if (v !== undefined && Number.isFinite(v)) sum += dbToMagnitude(v);
  }
  return sum;
}

/**
 * `[lo, hi]` (両端含む) の bin の dB 値の最大値（ピーク）を返す。
 * 該当する有限値が無ければ `-Infinity` を返す。範囲外は無視。
 *
 * 単一周波数の正弦波信号は本質的に 1 bin に集中するため、ピーク方式の方が
 * エネルギー合計より周辺ノイズに強く、結果的に SN 比が高く出る。
 */
export function bandPeakDb(buf: Float32Array, lo: number, hi: number): number {
  let peak = -Infinity;
  const start = Math.max(0, lo);
  const end = Math.min(buf.length - 1, hi);
  for (let i = start; i <= end; i++) {
    const v = buf[i];
    if (v !== undefined && Number.isFinite(v) && v > peak) peak = v;
  }
  return peak;
}

/**
 * `peakDb - noiseDb` を `[rangeMinDb, rangeMaxDb]` を 0〜1 にマップする。
 * 非有限値・レンジ無効時は 0 を返す。
 */
export function peakDbToProximity(
  peakDb: number,
  noiseDb: number,
  rangeMinDb: number,
  rangeMaxDb: number,
): number {
  if (rangeMaxDb <= rangeMinDb) return 0;
  if (!Number.isFinite(peakDb) || !Number.isFinite(noiseDb)) return 0;
  const signalDb = Math.max(0, peakDb - noiseDb);
  const t = (signalDb - rangeMinDb) / (rangeMaxDb - rangeMinDb);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/**
 * 参照帯域のスパイクを dB に正規化。
 * `refNoiseMag` が 0 / 非正なら 0 を返す。比が非有限なら 0 を返す。
 */
export function refSpikeDb(refMag: number, refNoiseMag: number): number {
  if (refNoiseMag <= 0) return 0;
  const ratio = refMag / refNoiseMag;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return 20 * Math.log10(ratio);
}

/**
 * 動的閾値補正: 参照帯域が `guardDb` を超えてスパイクしていたら、
 * 信号 magnitude から「ノイズフロアの `boostDb` 倍ぶん」を減算してから返す。
 * これにより環境ノイズ（擦れ音など）が target にも漏れた場合の誤反応を抑える。
 */
export function attenuateBySpike(
  sigMag: number,
  noiseMag: number,
  refSpike: number,
  guardDb: number,
  boostDb: number,
): number {
  if (refSpike <= guardDb) return sigMag;
  const boost = dbToMagnitude(boostDb);
  return Math.max(0, sigMag - noiseMag * boost);
}

/**
 * `targetMag / noiseMag` を dB 値に変換し、`[rangeMinDb, rangeMaxDb]` を 0〜1 にマップする。
 * - `noiseMag` が 0 / 非正なら 0 を返す
 * - 比が非有限・0 以下なら 0 を返す
 * - `rangeMaxDb <= rangeMinDb` の場合は 0 を返す（保護）
 */
export function magnitudeRatioToProximity(
  targetMag: number,
  noiseMag: number,
  rangeMinDb: number,
  rangeMaxDb: number,
): number {
  if (noiseMag <= 0) return 0;
  if (rangeMaxDb <= rangeMinDb) return 0;
  const ratio = targetMag / noiseMag;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  const db = 20 * Math.log10(ratio);
  const t = (db - rangeMinDb) / (rangeMaxDb - rangeMinDb);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

/** 配列の中央値。空配列なら fallback を返す。 */
export function median(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
