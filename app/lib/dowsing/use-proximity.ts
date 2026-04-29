import { useCallback, useEffect, useRef, useState } from "react";
import {
  BAND_HALF_HZ,
  DEBUG_LOG_INTERVAL_MS,
  EMA_ALPHA,
  ENABLE_REF_ATTENUATION,
  FFT_SIZE,
  NOISE_WINDOW_MS,
  RANGE_MAX_DB,
  RANGE_MIN_DB,
  REF_FREQ_OFFSET_HZ,
  REF_GUARD_DB,
  REF_THRESHOLD_BOOST_DB,
  TICK_MS,
} from "./config";
import { bandPeakDb, median, peakDbToProximity } from "./signal-math";

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
 * - 中心 ± BAND_HALF_HZ の範囲で「ピーク dB」を採取（PR #26 の実装と同等）
 *   単一周波数信号はピーク方式の方が周辺ノイズに強く感度が高い
 * - キャリブレーション窓でピーク dB の中央値をノイズフロアとして学習
 * - 評価時は `peak_db - noise_db` を `[RANGE_MIN_DB, RANGE_MAX_DB]` に線形マップ
 * - 参照帯域 (target + REF_FREQ_OFFSET_HZ) は計測してデバッグログにのみ出力（既定）。
 *   `ENABLE_REF_ATTENUATION` を true にすると動的減衰を有効化できる
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
  const lastDebugRef = useRef<number>(0);
  const proximityRef = useRef<number>(0);
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
    proximityRef.current = 0;
    setProximity(0);
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
          /* non-fatal */
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
    const targetCenterBin = Math.round(targetFreqHz / binHz);
    const refCenterBin = Math.round(
      (targetFreqHz + REF_FREQ_OFFSET_HZ) / binHz,
    );
    const halfBins = Math.max(1, Math.round(BAND_HALF_HZ / binHz));
    const bufLen = analyser.frequencyBinCount;
    const buf = new Float32Array(bufLen);

    const targetLo = Math.max(0, targetCenterBin - halfBins);
    const targetHi = Math.min(bufLen - 1, targetCenterBin + halfBins);
    const refLo = Math.max(0, refCenterBin - halfBins);
    const refHi = Math.min(bufLen - 1, refCenterBin + halfBins);

    // Calibration: collect peak-dB samples for noise floor over NOISE_WINDOW_MS
    const calibStart =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const targetSamples: number[] = [];
    const refSamples: number[] = [];
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
        const tPeak = bandPeakDb(buf, targetLo, targetHi);
        const rPeak = bandPeakDb(buf, refLo, refHi);
        if (Number.isFinite(tPeak)) targetSamples.push(tPeak);
        if (Number.isFinite(rPeak)) refSamples.push(rPeak);
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

    const noiseDb = median(targetSamples, -100);
    const refNoiseDb = median(refSamples, -100);

    proximityRef.current = 0;
    lastTickRef.current = 0;
    lastDebugRef.current = 0;
    setProximity(0);
    setState("active");

    const isDev =
      typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

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

      const targetPeakDb = bandPeakDb(buf, targetLo, targetHi);
      const refPeakDb = bandPeakDb(buf, refLo, refHi);
      const spike = Number.isFinite(refPeakDb) ? refPeakDb - refNoiseDb : 0;

      // 参照帯域による動的減衰は既定で無効（スピーカー漏れで常時誤発動した経緯）。
      // 有効時は noise_db に boost ぶん上乗せして実効的に閾値を上げる。
      const effectiveNoiseDb =
        ENABLE_REF_ATTENUATION && spike > REF_GUARD_DB
          ? noiseDb + REF_THRESHOLD_BOOST_DB
          : noiseDb;

      const raw =
        peakDbToProximity(
          targetPeakDb,
          effectiveNoiseDb,
          RANGE_MIN_DB,
          RANGE_MAX_DB,
        ) * 100;
      proximityRef.current =
        (1 - EMA_ALPHA) * proximityRef.current + EMA_ALPHA * raw;
      setProximity(proximityRef.current);

      if (isDev && now - lastDebugRef.current >= DEBUG_LOG_INTERVAL_MS) {
        lastDebugRef.current = now;
        const signalDb = Number.isFinite(targetPeakDb)
          ? Math.max(0, targetPeakDb - effectiveNoiseDb)
          : 0;
        console.log("[dowsing]", {
          targetPeakDb: Number.isFinite(targetPeakDb)
            ? targetPeakDb.toFixed(2)
            : "-Inf",
          noiseDb: noiseDb.toFixed(2),
          signalDb: signalDb.toFixed(2),
          refPeakDb: Number.isFinite(refPeakDb) ? refPeakDb.toFixed(2) : "-Inf",
          refNoiseDb: refNoiseDb.toFixed(2),
          spikeDb: spike.toFixed(2),
          attenuated: ENABLE_REF_ATTENUATION,
          proximity: proximityRef.current.toFixed(1),
        });
      }

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
