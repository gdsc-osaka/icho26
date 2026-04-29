import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEBUG_LOG_INTERVAL_MS,
  EMA_ALPHA,
  ENERGY_HALF_BINS,
  FFT_SIZE,
  LINEAR_RANGE_MAX,
  LINEAR_RANGE_MIN,
  NOISE_WINDOW_MS,
  REF_FREQ_OFFSET_HZ,
  REF_GUARD_DB,
  REF_THRESHOLD_BOOST_DB,
  TICK_MS,
  clamp,
} from "./config";
import {
  attenuateBySpike,
  bandEnergyMagnitude,
  median,
  refSpikeDb,
} from "./signal-math";

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
 * - 中心 ± ENERGY_HALF_BINS の bin を線形 magnitude で合計し、
 *   参照帯域 (target + REF_FREQ_OFFSET_HZ) のスパイクで動的に減衰
 * - キャリブレーション窓でノイズフロアを学習
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
    const bufLen = analyser.frequencyBinCount;
    const buf = new Float32Array(bufLen);

    const targetLo = Math.max(0, targetCenterBin - ENERGY_HALF_BINS);
    const targetHi = Math.min(bufLen - 1, targetCenterBin + ENERGY_HALF_BINS);
    const refLo = Math.max(0, refCenterBin - ENERGY_HALF_BINS);
    const refHi = Math.min(bufLen - 1, refCenterBin + ENERGY_HALF_BINS);

    // Calibration: collect noise floor over NOISE_WINDOW_MS (target / ref 両方)
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
        targetSamples.push(bandEnergyMagnitude(buf, targetLo, targetHi));
        refSamples.push(bandEnergyMagnitude(buf, refLo, refHi));
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

    const noiseMag = median(targetSamples, 0);
    const refNoiseMag = median(refSamples, 0);

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

      const targetMag = bandEnergyMagnitude(buf, targetLo, targetHi);
      const refMag = bandEnergyMagnitude(buf, refLo, refHi);
      const sigMag = Math.max(0, targetMag - noiseMag);
      const spike = refSpikeDb(refMag, refNoiseMag);
      const adjustedMag = attenuateBySpike(
        sigMag,
        noiseMag,
        spike,
        REF_GUARD_DB,
        REF_THRESHOLD_BOOST_DB,
      );
      const raw =
        clamp(
          (adjustedMag - LINEAR_RANGE_MIN) /
            (LINEAR_RANGE_MAX - LINEAR_RANGE_MIN),
          0,
          1,
        ) * 100;
      proximityRef.current =
        (1 - EMA_ALPHA) * proximityRef.current + EMA_ALPHA * raw;
      setProximity(proximityRef.current);

      if (isDev && now - lastDebugRef.current >= DEBUG_LOG_INTERVAL_MS) {
        lastDebugRef.current = now;
        console.log("[dowsing]", {
          targetMag: targetMag.toExponential(3),
          noiseMag: noiseMag.toExponential(3),
          sigMag: sigMag.toExponential(3),
          refMag: refMag.toExponential(3),
          refNoiseMag: refNoiseMag.toExponential(3),
          spikeDb: spike.toFixed(2),
          adjustedMag: adjustedMag.toExponential(3),
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
