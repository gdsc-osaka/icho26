import { useCallback, useEffect, useRef, useState } from "react";
import {
  BAND_HALF_HZ,
  EMA_ALPHA,
  FFT_SIZE,
  NOISE_WINDOW_MS,
  RANGE_MAX_DB,
  RANGE_MIN_DB,
  TICK_MS,
  clamp,
} from "./config";

export type ProximityState = "idle" | "requesting" | "active" | "unavailable";

type Result = {
  state: ProximityState;
  /** 0-100 の接近度。state が "active" のとき更新される */
  proximity: number;
  errorReason: string | null;
  start: () => Promise<void>;
  stop: () => void;
};

/**
 * マイク入力から targetFreqHz 付近の信号強度を抽出して接近度を返す hook。
 * - getUserMedia + AudioContext + AnalyserNode を内包
 * - キャリブレーション窓でノイズフロアを学習し相対dBで判定
 * - tick_ms 周期の評価ループ + EMA 平滑化
 * - アンマウント時に確実にクリーンアップ
 */
export function useProximity(targetFreqHz: number): Result {
  const [state, setState] = useState<ProximityState>("idle");
  const [proximity, setProximity] = useState(0);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const proximityRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (ctxRef.current) {
      void ctxRef.current.close();
      ctxRef.current = null;
    }
    analyserRef.current = null;
    proximityRef.current = 0;
    setProximity(0);
    setState("idle");
  }, []);

  const start = useCallback(async () => {
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
      setErrorReason((err as Error)?.name ?? "UnknownError");
      setState("unavailable");
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
    } catch {
      for (const t of stream.getTracks()) t.stop();
      setErrorReason("AudioContextUnavailable");
      setState("unavailable");
      return;
    }

    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);

    streamRef.current = stream;
    ctxRef.current = ctx;
    analyserRef.current = analyser;

    const sampleRate = ctx.sampleRate;
    const binHz = sampleRate / FFT_SIZE;
    const centerBin = Math.round(targetFreqHz / binHz);
    const halfBins = Math.max(1, Math.round(BAND_HALF_HZ / binHz));
    const bufLen = analyser.frequencyBinCount;
    const buf = new Float32Array(bufLen);

    // Calibration: collect noise floor over NOISE_WINDOW_MS
    const calibStart = performance.now();
    const noiseSamples: number[] = [];
    await new Promise<void>((resolve) => {
      const sample = () => {
        analyser.getFloatFrequencyData(buf);
        let peak = -Infinity;
        for (
          let i = Math.max(0, centerBin - halfBins);
          i <= Math.min(bufLen - 1, centerBin + halfBins);
          i++
        ) {
          if (buf[i]! > peak) peak = buf[i]!;
        }
        if (Number.isFinite(peak)) noiseSamples.push(peak);
        if (performance.now() - calibStart >= NOISE_WINDOW_MS) {
          resolve();
          return;
        }
        rafRef.current = requestAnimationFrame(sample);
      };
      rafRef.current = requestAnimationFrame(sample);
    });

    if (!analyserRef.current) {
      // Stopped during calibration
      return;
    }

    noiseSamples.sort((a, b) => a - b);
    const noiseDb =
      noiseSamples.length > 0
        ? noiseSamples[Math.floor(noiseSamples.length / 2)]!
        : -100;

    setState("active");
    proximityRef.current = 0;
    lastTickRef.current = 0;

    const tick = (now: number) => {
      if (!analyserRef.current) return;
      if (now - lastTickRef.current < TICK_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastTickRef.current = now;

      analyserRef.current.getFloatFrequencyData(buf);
      let peak = -Infinity;
      for (
        let i = Math.max(0, centerBin - halfBins);
        i <= Math.min(bufLen - 1, centerBin + halfBins);
        i++
      ) {
        if (buf[i]! > peak) peak = buf[i]!;
      }
      const signalDb = Math.max(0, peak - noiseDb);
      const raw =
        clamp((signalDb - RANGE_MIN_DB) / (RANGE_MAX_DB - RANGE_MIN_DB), 0, 1) *
        100;
      proximityRef.current =
        (1 - EMA_ALPHA) * proximityRef.current + EMA_ALPHA * raw;
      setProximity(proximityRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [targetFreqHz]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { state, proximity, errorReason, start, stop };
}
