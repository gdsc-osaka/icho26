import { useCallback, useEffect, useRef, useState } from "react";

export type ToneGeneratorState = "idle" | "playing" | "unavailable";

const TONE_FADE_MS = 10;

type Result = {
  state: ToneGeneratorState;
  /** 現在発信中の周波数（Hz）。idle 時は最後に設定された値 */
  frequency: number;
  /** 0..1 の出力レベル */
  level: number;
  errorReason: string | null;
  start: (freqHz: number, level: number) => Promise<void>;
  stop: () => void;
  setFrequency: (freqHz: number) => void;
  setLevel: (level: number) => void;
};

/**
 * 端末スピーカーから連続正弦波を出すトーン発生 hook。
 * - 起動・停止時に TONE_FADE_MS でクリックノイズを抑制
 * - frequency / level は再生中に滑らかに変更可能
 * - アンマウント時に自動停止
 */
export function useToneGenerator(initialFrequency = 19000): Result {
  const [state, setState] = useState<ToneGeneratorState>("idle");
  const [frequency, setFrequencyState] = useState(initialFrequency);
  const [level, setLevelState] = useState(0.3);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  // start() の世代トークン。stop() / 新しい start() でインクリメントし、
  // in-flight の start() が古い世代だったら結果を破棄する。
  const startGenRef = useRef(0);

  const stop = useCallback(() => {
    startGenRef.current += 1;
    const ctx = ctxRef.current;
    const osc = oscRef.current;
    const gain = gainRef.current;
    ctxRef.current = null;
    oscRef.current = null;
    gainRef.current = null;
    if (ctx && osc && gain) {
      const t = ctx.currentTime;
      const fade = TONE_FADE_MS / 1000;
      try {
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + fade);
        osc.stop(t + fade + 0.02);
      } catch {
        /* ignore: 既に停止済み等 */
      }
      window.setTimeout(
        () => {
          void ctx.close().catch(() => undefined);
        },
        (TONE_FADE_MS + 50) | 0,
      );
    }
    setState("idle");
  }, []);

  const start = useCallback(
    async (freqHz: number, levelArg: number) => {
      stop(); // 既存トーンをフェードアウトしてから再起動（世代も +1）
      const myGen = ++startGenRef.current;
      setErrorReason(null);
      setFrequencyState(freqHz);
      setLevelState(levelArg);

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) {
        if (myGen !== startGenRef.current) return;
        setErrorReason("AudioContextUnavailable");
        setState("unavailable");
        return;
      }

      let ctx: AudioContext;
      try {
        ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          try {
            await ctx.resume();
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (myGen !== startGenRef.current) return;
        setErrorReason("AudioContextCreateFailed");
        setState("unavailable");
        return;
      }

      // ctx.resume の await 中に新しい start() / stop() が来ていたら破棄
      if (myGen !== startGenRef.current) {
        void ctx.close().catch(() => undefined);
        return;
      }

      let osc: OscillatorNode;
      let gain: GainNode;
      try {
        osc = ctx.createOscillator();
        gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freqHz;
        const now = ctx.currentTime;
        const fade = TONE_FADE_MS / 1000;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(levelArg, now + fade);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
      } catch {
        void ctx.close().catch(() => undefined);
        if (myGen !== startGenRef.current) return;
        setErrorReason("OscillatorCreateFailed");
        setState("unavailable");
        return;
      }

      // ノードを ref に書き込む直前に最終チェック
      if (myGen !== startGenRef.current) {
        try {
          osc.stop();
        } catch {
          /* ignore */
        }
        void ctx.close().catch(() => undefined);
        return;
      }

      ctxRef.current = ctx;
      oscRef.current = osc;
      gainRef.current = gain;
      setState("playing");
    },
    [stop],
  );

  const setFrequency = useCallback((freqHz: number) => {
    setFrequencyState(freqHz);
    const ctx = ctxRef.current;
    const osc = oscRef.current;
    if (ctx && osc) {
      try {
        osc.frequency.linearRampToValueAtTime(freqHz, ctx.currentTime + 0.02);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const setLevel = useCallback((next: number) => {
    setLevelState(next);
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    if (ctx && gain) {
      try {
        gain.gain.linearRampToValueAtTime(next, ctx.currentTime + 0.05);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    state,
    frequency,
    level,
    errorReason,
    start,
    stop,
    setFrequency,
    setLevel,
  };
}
