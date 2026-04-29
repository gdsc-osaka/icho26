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
 * - アンマウント時 / stop() 呼び出し時に確実にクリーンアップ
 *
 * 並行性: 起動中は再 start() を黙って無視する（state==="idle" or "unavailable" のときのみ受理）。
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
  // キャリブレーション中の早期キャンセル検知用 token
  const runIdRef = useRef<number>(0);
  const stateRef = useRef<ProximityState>("idle");
  stateRef.current = state;

  const stop = useCallback(() => {
    runIdRef.current += 1; // pending ループに「あなたは無効」を伝える
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
    proximityRef.current = 0;
    setProximity(0);
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    // 既に起動中（requesting / active）なら無視。再エントリー防止。
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
      if (runIdRef.current !== myRunId) return; // stop() が走った
      setErrorReason((err as Error)?.name ?? "UnknownError");
      setState("unavailable");
      return;
    }

    if (runIdRef.current !== myRunId) {
      // start 中に stop() が割り込んだ。stream を即破棄。
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
      // iOS Safari は新規 AudioContext が "suspended" で起動するため明示 resume
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          // resume 失敗は致命ではない（mic 入力で動く可能性あり）
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
    const halfBins = Math.max(1, Math.round(BAND_HALF_HZ / binHz));
    const bufLen = analyser.frequencyBinCount;
    const buf = new Float32Array(bufLen);
    const lo = Math.max(0, centerBin - halfBins);
    const hi = Math.min(bufLen - 1, centerBin + halfBins);

    const peakInBand = (): number => {
      let peak = -Infinity;
      for (let i = lo; i <= hi; i++) {
        const v = buf[i];
        if (v !== undefined && v > peak) peak = v;
      }
      return peak;
    };

    // Calibration: collect noise floor over NOISE_WINDOW_MS
    const calibStart =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const noiseSamples: number[] = [];
    await new Promise<void>((resolve) => {
      const sample = () => {
        // stop() 検知
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
        if (Number.isFinite(peak)) noiseSamples.push(peak);
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

    if (runIdRef.current !== myRunId || !analyserRef.current) {
      // stop() がキャリブレーション中に走った
      return;
    }

    noiseSamples.sort((a, b) => a - b);
    const noiseDb =
      noiseSamples.length > 0
        ? noiseSamples[Math.floor(noiseSamples.length / 2)]!
        : -100;

    proximityRef.current = 0;
    lastTickRef.current = 0;
    setProximity(0);
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
      const peak = peakInBand();
      const signalDb = Number.isFinite(peak) ? Math.max(0, peak - noiseDb) : 0;
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
