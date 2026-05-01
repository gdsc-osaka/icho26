/**
 * ダウジング機能の静的設定値。
 * 実行時の周波数切替は行わず、ルート (`q1.1.tsx` / `q1.2.tsx`) ごとに
 * 対応する定数を import して `useProximity` に渡す。
 *
 * 既定値はすべて実体検証で再調整可能（specs/dowsing-spec.md §7 参照）。
 */

export const FREQ_Q1_1_HZ = 19000;
export const FREQ_Q1_2_HZ = 20000;

export const FFT_SIZE = 8192;
export const NOISE_WINDOW_MS = 1500;
export const TICK_MS = 60;

/**
 * 帯域抽出方式。
 * - "peak": 帯域内 dB の最大値を信号レベルとする。広い帯域（PEAK_BAND_HALF_HZ）で取り、
 *   ピークが立った瞬間に強く反応する。広帯域ノイズには強いが、リーケージで取りこぼしやすい。
 * - "energy_sum": 帯域内の線形 magnitude を合計し、20*log10(target/noise) を信号 dB とする。
 *   FFT リーケージ全部を取り込めるので連続正弦波の検出に強い。狭帯域（ENERGY_HALF_BINS）必須。
 */
export type DetectionMethod = "peak" | "energy_sum";

export const DEFAULT_DETECTION_METHOD: DetectionMethod = "peak";

// Peak 方式: 中心 ± この Hz を帯域とし dB ピークを取る
export const PEAK_BAND_HALF_HZ = 100;
export const PEAK_RANGE_MIN_DB = 6;
export const PEAK_RANGE_MAX_DB = 36;

// Energy-sum 方式: 中心 ± この bin 数（≒±29 Hz @ 48kHz/8192）の線形 magnitude を合計
export const ENERGY_HALF_BINS = 5;
export const ENERGY_RANGE_MIN_DB = 3;
export const ENERGY_RANGE_MAX_DB = 30;

// Smoothing
export const EMA_ALPHA = 0.3;

// Circle visualization
export const CIRCLE_SIZE_MIN_PX = 80;
export const CIRCLE_SIZE_MAX_PX = 240;
export const CIRCLE_SHAKE_MAX_PX = 12;
export const CIRCLE_SIZE_COEF = 1.0;
export const CIRCLE_SHAKE_COEF = 1.0;

// Vibration (Android)
export const VIB_PULSE_MS = 100;
export const VIB_GAP_MIN_MS = 60;
export const VIB_GAP_MAX_MS = 800;

// Beep fallback (iOS etc.)
export const BEEP_FREQ_HZ = 880;
export const BEEP_PULSE_MS = 80;
export const BEEP_GAP_MIN_MS = 80;
export const BEEP_GAP_MAX_MS = 900;

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
