/**
 * ダウジング機能の静的設定値。
 * 実行時の周波数切替は行わず、ルート (`q1.1.tsx` / `q1.2.tsx`) ごとに
 * 対応する定数を import して `useProximity` に渡す。
 *
 * 既定値はすべて実体検証で再調整可能（specs/dowsing-spec.md §7 参照）。
 */

export const FREQ_Q1_1_HZ = 19000;
export const FREQ_Q1_2_HZ = 20000;

export const BAND_HALF_HZ = 100;
export const FFT_SIZE = 8192;
export const NOISE_WINDOW_MS = 1500;
export const TICK_MS = 60;

// Signal -> proximity mapping (dB)
export const RANGE_MIN_DB = 6;
export const RANGE_MAX_DB = 36;

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
