import { useCallback, useEffect, useRef, useState } from "react";
import {
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
import { useDetectionMethod } from "./use-detection-method";

/** 0 除算回避用の十分小さい magnitude フロア（≒ -200 dB） */
const MIN_NOISE_MAG = 1e-10;

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
  /** 現在選択中の方式の proximity（0-100） */
  proximity: number;
  /** 両方式の生計測値。比較用 */
  metrics: ProximityMetrics;
  /** 現在採用中の方式（override 指定時はそれ、未指定時は localStorage 設定） */
  method: DetectionMethod;
  errorReason: string | null;
  start: () => Promise<void>;
  stop: () => void;
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
  const [stored] = useDetectionMethod();
  const method = options?.method ?? stored;

  const [state, setState] = useState<ProximityState>("idle");
  const [proximity, setProximity] = useState(0);
  const [metrics, setMetrics] = useState<ProximityMetrics>(ZERO_METRICS);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  // 各方式の EMA 状態を独立に保持
  const peakProxRef = useRef<number>(0);
  const energyProxRef = useRef<number>(0);
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
    peakProxRef.current = 0;
    energyProxRef.current = 0;
    setProximity(0);
    setMetrics(ZERO_METRICS);
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

    const sampleRate = ctx.sampleRate;
    const binHz = sampleRate / FFT_SIZE;
    const centerBin = Math.round(targetFreqHz / binHz);
    const bufLen = analyser.frequencyBinCount;
    const buf = new Float32Array(bufLen);

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

  return { state, proximity, metrics, method, errorReason, start, stop };
}
