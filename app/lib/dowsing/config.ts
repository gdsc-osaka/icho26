/**
 * ダウジング機能の静的設定値。
 * 実行時の周波数切替は行わず、ルート (`q1.1.tsx` / `q1.2.tsx`) ごとに
 * 対応する定数を import して `useProximity` に渡す。
 *
 * 既定値はすべて実体検証で再調整可能（specs/dowsing-spec.md §7 参照）。
 */

// 対象周波数。18,600 Hz は若年層に微かに聞こえる可能性があるが
// 18 kHz 以下の不快音域を避けつつ、20 kHz の高域減衰問題からも離す中間点として採用。
// 20,000 Hz は端末によって減衰しうるが多くの機器で取得可能。
export const FREQ_Q1_1_HZ = 18600;
export const FREQ_Q1_2_HZ = 20000;

// FFT
export const FFT_SIZE = 8192;

// 狭帯域抽出: 中心周波数 ± BAND_HALF_HZ の範囲内で「最大 dB 値」を採取する（ピーク方式）。
// PR #26 当時の実装と同等。エネルギー合計（線形 magnitude 和）方式は周辺 bin のノイズで
// 感度が低下したため、純粋な単一周波数信号にはピーク方式の方が反応が良い。
// 48 kHz サンプリング × FFT 8192 → 約 5.86 Hz/bin。±100 Hz ≒ ±17 bin で評価。
export const BAND_HALF_HZ = 100;

// 参照帯域: 対象周波数の +400 Hz を「環境ノイズ監視窓」として常時計測する。
// Q1-1 → 19,000 Hz、Q1-2 → 20,400 Hz。可聴域 (〜18 kHz) には落ちない。
// 計測値はデバッグログにのみ出力する（後段の動的減衰は spec/dowsing-spec.md
// §4.3 で定義されているが、スピーカーのスペクトル漏れで常時誤発動するため
// 既定では無効。ENABLE_REF_ATTENUATION を true にすると有効化できる）。
export const REF_FREQ_OFFSET_HZ = 400;
export const REF_GUARD_DB = 9;
export const REF_THRESHOLD_BOOST_DB = 6;
export const ENABLE_REF_ATTENUATION = false;

// キャリブレーション
export const NOISE_WINDOW_MS = 1500;

// 評価周期
export const TICK_MS = 60;

// 接近度マッピング（dB スケール）。
// signal_db = peak_db_of_band - noise_db を proximity 0〜100 に線形マッピング。
// PR #26 と同じ 6〜36 dB レンジ（実機検証で良好だった値）。
export const RANGE_MIN_DB = 6; // proximity=0 にマップする signal_db
export const RANGE_MAX_DB = 25; // proximity=100 にマップする signal_db

// 時間平滑化
export const EMA_ALPHA = 0.3;

// デバッグ出力 throttle
export const DEBUG_LOG_INTERVAL_MS = 250;

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
export const BEEP_FADE_MS = 10; // クリックノイズ防止のための fade in/out

// テストトーン (operator/dowsing-test)
export const TONE_FADE_MS = 10;
export const TONE_DEFAULT_LEVEL = 0.3;

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
