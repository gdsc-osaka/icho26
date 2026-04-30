import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_DETECTION_METHOD,
  type DetectionMethod,
  EMA_ALPHA,
  ENERGY_HALF_BINS,
  ENERGY_RANGE_MAX_DB,
  ENERGY_RANGE_MIN_DB,
  FFT_SIZE,
  NOISE_WINDOW_MS,
  PEAK_BAND_HALF_HZ,
  PEAK_RANGE_MAX_DB,
  PEAK_RANGE_MIN_DB,
  TICK_MS,
  clamp,
} from "./config";

/** 0 除算回避用の十分小さい magnitude フロア（≒ -200 dB） */
const MIN_NOISE_MAG = 1e-10;

/**
 * 動的 proximity を計算する際の最低レンジ (dB)。
 * 履歴の max - min がこの値より小さい場合は、これを分母として用いる。
 * これにより停止時の (max ≈ min) で 0 除算を防ぎつつ、わずかな揺らぎで
 * 値が乱高下するのを抑える。
 */
const DYNAMIC_RANGE_FLOOR_DB = 5;

/** signalDb 履歴の保持期間（ms） */
export const HISTORY_DURATION_MS = 30_000;
/** リングバッファ容量。TICK_MS の余裕分も含む */
const HISTORY_CAPACITY =
  Math.ceil(HISTORY_DURATION_MS / 60 /* TICK_MS */) + 16;

export type HistoryBuffers = {
  /** タイムスタンプ (performance.now() ベース、ms) */
  time: Float32Array;
  /** peak 方式の signalDb */
  peakDb: Float32Array;
  /** energy_sum 方式の signalDb */
  energyDb: Float32Array;
};

export type ProximityState = "idle" | "requesting" | "active" | "unavailable";

export type ProximityMetric = {
  /** EMA 平滑化後の 0-100 値 */
  proximity: number;
  /** 平滑化前の 0-100 値（生） */
  raw: number;
  /** 信号 dB（noise 比）。0 にクリップ済み */
  signalDb: number;
};

export type ProximityMetrics = {
  peak: ProximityMetric;
  energy: ProximityMetric;
};

const ZERO_METRIC: ProximityMetric = { proximity: 0, raw: 0, signalDb: 0 };
const ZERO_METRICS: ProximityMetrics = { peak: ZERO_METRIC, energy: ZERO_METRIC };

type Result = {
  state: ProximityState;
  /** 現在選択中の方式の proximity（0-100）。静的 RANGE_*_DB で固定マッピング */
  proximity: number;
  /**
   * 過去 HISTORY_DURATION_MS の peak signalDb の min..max に対する現在値の
   * 相対位置（0-100、EMA 平滑化済み）。端末個体差に依存しない感度演出向け。
   * 履歴幅が DYNAMIC_RANGE_FLOOR_DB 未満のときはこの値が分母になり 0 近辺に張り付く。
   */
  dynamicProximity: number;
  /** 両方式の生計測値。比較用 */
  metrics: ProximityMetrics;
  /** 現在採用中の方式（override 指定時はそれ、未指定時は localStorage 設定） */
  method: DetectionMethod;
  errorReason: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /**
   * 最新の周波数スペクトル（dB 値）を `out` に書き込む。
   * 書き込めた場合 true、analyser がまだ存在しない / 失敗時は false。
   * 描画ループから毎フレーム呼び出して使う想定（再レンダなしで読み取れる）。
   * `out.length` は `frequencyBinCount` (= FFT_SIZE / 2) と一致させること。
   */
  getSpectrum: (out: Float32Array) => boolean;
  /** AudioContext のサンプルレート。bin → Hz 変換用。idle 時は 0 */
  sampleRate: number;
  /**
   * 過去 HISTORY_DURATION_MS 分の signalDb 履歴を時刻昇順で out に書き込む。
   * 戻り値は書き込んだサンプル数（≤ out.*.length, ≤ historyCapacity）。
   * 描画ループから毎フレーム呼び出す想定（再レンダなし）。
   */
  getHistory: (out: HistoryBuffers) => number;
  /** 履歴リングバッファの容量。consumer はこのサイズ以上の Float32Array を確保する */
  historyCapacity: number;
};

type Options = {
  /** 検出方式の上書き。未指定なら useDetectionMethod() の値を使用 */
  method?: DetectionMethod;
};

/**
 * マイク入力から targetFreqHz 付近の信号強度を抽出して接近度を返す hook。
 * - getUserMedia + AudioContext + AnalyserNode を内包
 * - 毎 tick **両方式（peak / energy_sum）を同じ FFT バッファで同時計算**
 * - tick_ms 周期 + EMA 平滑化、各方式独立に EMA を持つ
 * - localStorage で選択中方式を共有（useDetectionMethod 経由）
 *
 * 並行性: 起動中は再 start() を黙って無視する（state==="idle" or "unavailable" のときのみ受理）。
 */
export function useProximity(targetFreqHz: number, options?: Options): Result {
  const method = options?.method ?? DEFAULT_DETECTION_METHOD;

  const [state, setState] = useState<ProximityState>("idle");
  const [proximity, setProximity] = useState(0);
  const [dynamicProximity, setDynamicProximity] = useState(0);
  const [metrics, setMetrics] = useState<ProximityMetrics>(ZERO_METRICS);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [sampleRate, setSampleRate] = useState(0);
  // 描画コンポーネント側から再レンダ無しで FFT バッファを読み出すための ref
  const getSpectrumRef = useRef<(out: Float32Array) => boolean>(() => false);

  // signalDb 履歴のリングバッファ。tick で書き込み、描画から getHistory で読み出す
  const histTimeRef = useRef<Float32Array>(new Float32Array(HISTORY_CAPACITY));
  const histPeakRef = useRef<Float32Array>(new Float32Array(HISTORY_CAPACITY));
  const histEnergyRef = useRef<Float32Array>(new Float32Array(HISTORY_CAPACITY));
  const histWriteRef = useRef<number>(0);
  const histCountRef = useRef<number>(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  // 各方式の EMA 状態を独立に保持
  const peakProxRef = useRef<number>(0);
  const energyProxRef = useRef<number>(0);
  // 動的 proximity（履歴 min/max 比）の EMA
  const dynamicProxRef = useRef<number>(0);
  // 評価ループ側で読む現在の選択方式
  const methodRef = useRef<DetectionMethod>(method);
  methodRef.current = method;
  // キャリブレーション中の早期キャンセル検知用 token
  const runIdRef = useRef<number>(0);
  const stateRef = useRef<ProximityState>("idle");
  stateRef.current = state;

  const stop = useCallback(() => {
    runIdRef.current += 1;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => undefined);
      ctxRef.current = null;
    }
    analyserRef.current = null;
    getSpectrumRef.current = () => false;
    peakProxRef.current = 0;
    energyProxRef.current = 0;
    dynamicProxRef.current = 0;
    histWriteRef.current = 0;
    histCountRef.current = 0;
    setProximity(0);
    setDynamicProximity(0);
    setMetrics(ZERO_METRICS);
    setSampleRate(0);
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (stateRef.current === "requesting" || stateRef.current === "active") {
      return;
    }
    const myRunId = runIdRef.current + 1;
    runIdRef.current = myRunId;
    setErrorReason(null);
    setState("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err) {
      if (runIdRef.current !== myRunId) return;
      setErrorReason((err as Error)?.name ?? "UnknownError");
      setState("unavailable");
      return;
    }

    if (runIdRef.current !== myRunId) {
      for (const t of stream.getTracks()) t.stop();
      return;
    }

    let ctx: AudioContext;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) throw new Error("AudioContextUnavailable");
      ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* ignore */
        }
      }
    } catch {
      for (const t of stream.getTracks()) t.stop();
      if (runIdRef.current !== myRunId) return;
      setErrorReason("AudioContextUnavailable");
      setState("unavailable");
      return;
    }

    if (runIdRef.current !== myRunId) {
      for (const t of stream.getTracks()) t.stop();
      void ctx.close().catch(() => undefined);
      return;
    }

    let analyser: AnalyserNode;
    try {
      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0;
      src.connect(analyser);
    } catch {
      for (const t of stream.getTracks()) t.stop();
      void ctx.close().catch(() => undefined);
      if (runIdRef.current !== myRunId) return;
      setErrorReason("AnalyserUnavailable");
      setState("unavailable");
      return;
    }

    streamRef.current = stream;
    ctxRef.current = ctx;
    analyserRef.current = analyser;

    const ctxSampleRate = ctx.sampleRate;
    const binHz = ctxSampleRate / FFT_SIZE;
    const centerBin = Math.round(targetFreqHz / binHz);
    const bufLen = analyser.frequencyBinCount;
    const buf = new Float32Array(bufLen);

    setSampleRate(ctxSampleRate);
    // 描画用の getter を ref に差し替える。外部から RAF で呼ばれる前提。
    getSpectrumRef.current = (out) => {
      const a = analyserRef.current;
      if (!a) return false;
      if (out.length !== a.frequencyBinCount) return false;
      try {
        // lib.dom の getFloatFrequencyData は Float32Array<ArrayBuffer> を要求するが、
        // 通常の new Float32Array(N) は ArrayBufferLike として推論されるためキャストする。
        a.getFloatFrequencyData(out as Float32Array<ArrayBuffer>);
        return true;
      } catch {
        return false;
      }
    };

    // peak 方式のための広めの帯域
    const peakHalfBins = Math.max(1, Math.round(PEAK_BAND_HALF_HZ / binHz));
    const peakLo = Math.max(0, centerBin - peakHalfBins);
    const peakHi = Math.min(bufLen - 1, centerBin + peakHalfBins);

    // energy_sum 方式のための狭めの帯域
    const energyHalfBins = Math.max(1, ENERGY_HALF_BINS);
    const energyLo = Math.max(0, centerBin - energyHalfBins);
    const energyHi = Math.min(bufLen - 1, centerBin + energyHalfBins);

    const peakInBand = (): number => {
      let peakDb = -Infinity;
      for (let i = peakLo; i <= peakHi; i++) {
        const v = buf[i];
        if (v !== undefined && v > peakDb) peakDb = v;
      }
      return peakDb;
    };

    const sumMagInBand = (): number => {
      let sum = 0;
      for (let i = energyLo; i <= energyHi; i++) {
        const v = buf[i];
        if (v !== undefined && Number.isFinite(v)) {
          sum += 10 ** (v / 20);
        }
      }
      return sum;
    };

    // Calibration: 両方式のノイズフロアを並行収集
    const calibStart =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const peakSamples: number[] = [];
    const energySamples: number[] = [];
    await new Promise<void>((resolve) => {
      const sample = () => {
        if (runIdRef.current !== myRunId || !analyserRef.current) {
          resolve();
          return;
        }
        try {
          analyserRef.current.getFloatFrequencyData(buf);
        } catch {
          resolve();
          return;
        }
        const peak = peakInBand();
        if (Number.isFinite(peak)) peakSamples.push(peak);
        const sum = sumMagInBand();
        if (sum > 0 && Number.isFinite(sum)) energySamples.push(sum);
        const now =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        if (now - calibStart >= NOISE_WINDOW_MS) {
          resolve();
          return;
        }
        rafRef.current = requestAnimationFrame(sample);
      };
      rafRef.current = requestAnimationFrame(sample);
    });

    if (runIdRef.current !== myRunId || !analyserRef.current) return;

    peakSamples.sort((a, b) => a - b);
    energySamples.sort((a, b) => a - b);
    const peakNoiseDb =
      peakSamples.length > 0
        ? peakSamples[Math.floor(peakSamples.length / 2)]
        : -100;
    const energyNoiseSum =
      energySamples.length > 0
        ? Math.max(
            MIN_NOISE_MAG,
            energySamples[Math.floor(energySamples.length / 2)],
          )
        : MIN_NOISE_MAG;

    peakProxRef.current = 0;
    energyProxRef.current = 0;
    lastTickRef.current = 0;
    setProximity(0);
    setMetrics(ZERO_METRICS);
    setState("active");

    const tick = (now: number) => {
      if (runIdRef.current !== myRunId || !analyserRef.current) return;
      if (now - lastTickRef.current < TICK_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTickRef.current = now;

      try {
        analyserRef.current.getFloatFrequencyData(buf);
      } catch {
        return;
      }

      // peak
      const peakDb = peakInBand();
      const peakSignalDb = Number.isFinite(peakDb)
        ? Math.max(0, peakDb - peakNoiseDb)
        : 0;
      const peakRaw =
        clamp(
          (peakSignalDb - PEAK_RANGE_MIN_DB) /
            (PEAK_RANGE_MAX_DB - PEAK_RANGE_MIN_DB),
          0,
          1,
        ) * 100;
      peakProxRef.current =
        (1 - EMA_ALPHA) * peakProxRef.current + EMA_ALPHA * peakRaw;

      // energy sum
      const targetSum = sumMagInBand();
      const ratio = targetSum / energyNoiseSum;
      const energySignalDb =
        ratio > 0 ? Math.max(0, 20 * Math.log10(ratio)) : 0;
      const energyRaw =
        clamp(
          (energySignalDb - ENERGY_RANGE_MIN_DB) /
            (ENERGY_RANGE_MAX_DB - ENERGY_RANGE_MIN_DB),
          0,
          1,
        ) * 100;
      energyProxRef.current =
        (1 - EMA_ALPHA) * energyProxRef.current + EMA_ALPHA * energyRaw;

      // 履歴リングバッファに書き込み（時系列グラフ用）
      const widx = histWriteRef.current;
      histTimeRef.current[widx] = now;
      histPeakRef.current[widx] = peakSignalDb;
      histEnergyRef.current[widx] = energySignalDb;
      histWriteRef.current = (widx + 1) % HISTORY_CAPACITY;
      if (histCountRef.current < HISTORY_CAPACITY) {
        histCountRef.current += 1;
      }

      // 動的 proximity: 履歴 min..max に対する peakSignalDb の相対位置
      const hCount = histCountRef.current;
      let histMin = peakSignalDb;
      let histMax = peakSignalDb;
      for (let k = 0; k < hCount; k++) {
        const v = histPeakRef.current[k];
        if (v < histMin) histMin = v;
        if (v > histMax) histMax = v;
      }
      const dynamicRange = Math.max(
        DYNAMIC_RANGE_FLOOR_DB,
        histMax - histMin,
      );
      const dynamicRaw =
        clamp((peakSignalDb - histMin) / dynamicRange, 0, 1) * 100;
      dynamicProxRef.current =
        (1 - EMA_ALPHA) * dynamicProxRef.current + EMA_ALPHA * dynamicRaw;
      setDynamicProximity(dynamicProxRef.current);

      const next: ProximityMetrics = {
        peak: {
          proximity: peakProxRef.current,
          raw: peakRaw,
          signalDb: peakSignalDb,
        },
        energy: {
          proximity: energyProxRef.current,
          raw: energyRaw,
          signalDb: energySignalDb,
        },
      };
      setMetrics(next);
      setProximity(
        methodRef.current === "peak"
          ? peakProxRef.current
          : energyProxRef.current,
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [targetFreqHz]);

  // 動作中に method が切り替わった場合も、表示用 proximity だけ即時切替
  useEffect(() => {
    if (stateRef.current !== "active") return;
    setProximity(
      method === "peak" ? peakProxRef.current : energyProxRef.current,
    );
  }, [method]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // 親コンポーネントからは安定参照の関数を渡したいので、ref を呼ぶラッパを useCallback で返す
  const getSpectrum = useCallback((out: Float32Array): boolean => {
    return getSpectrumRef.current(out);
  }, []);

  // 履歴を時刻昇順で out に書き込んで実サンプル数を返す
  const getHistory = useCallback((out: HistoryBuffers): number => {
    const count = histCountRef.current;
    if (count === 0) return 0;
    const cap = Math.min(
      out.time.length,
      out.peakDb.length,
      out.energyDb.length,
      count,
    );
    // 古い側の先頭インデックス: バッファが満杯なら write 位置、未満なら 0
    const startIdx =
      count < HISTORY_CAPACITY ? 0 : histWriteRef.current;
    // 末尾 cap 個を取り出す（古いものから新しいものへ昇順）
    const begin = (startIdx + (count - cap)) % HISTORY_CAPACITY;
    for (let i = 0; i < cap; i++) {
      const r = (begin + i) % HISTORY_CAPACITY;
      out.time[i] = histTimeRef.current[r];
      out.peakDb[i] = histPeakRef.current[r];
      out.energyDb[i] = histEnergyRef.current[r];
    }
    return cap;
  }, []);

  return {
    state,
    proximity,
    dynamicProximity,
    metrics,
    method,
    errorReason,
    start,
    stop,
    getSpectrum,
    sampleRate,
    getHistory,
    historyCapacity: HISTORY_CAPACITY,
  };
}
