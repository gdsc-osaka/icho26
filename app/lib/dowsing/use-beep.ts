import { useEffect, useRef } from "react";
import {
  BEEP_FREQ_HZ,
  BEEP_GAP_MAX_MS,
  BEEP_GAP_MIN_MS,
  BEEP_PULSE_MS,
  clamp,
} from "./config";

function isAndroidWithVibrate(): boolean {
  if (typeof navigator === "undefined") return false;
  return "vibrate" in navigator && /Android/i.test(navigator.userAgent);
}

/**
 * バイブ非対応端末向けのフォールバックビープ。
 * 接近度に応じてビープ間隔を短縮する。
 */
export function useBeep(active: boolean, proximity: number) {
  const proximityRef = useRef(proximity);

  useEffect(() => {
    proximityRef.current = proximity;
  }, [proximity]);

  useEffect(() => {
    if (!active) return;
    if (isAndroidWithVibrate()) return; // Android はバイブ側で処理
    if (typeof window === "undefined") return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    let ctx: AudioContext;
    try {
      ctx = new AudioCtx();
    } catch {
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    const ensureRunning = async () => {
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* ignore */
        }
      }
    };
    void ensureRunning();

    const playBeep = () => {
      if (cancelled || ctx.state === "closed") return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = BEEP_FREQ_HZ;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.005);
        gain.gain.linearRampToValueAtTime(
          0,
          ctx.currentTime + BEEP_PULSE_MS / 1000,
        );
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + BEEP_PULSE_MS / 1000 + 0.02);
      } catch {
        /* ignore transient audio errors */
      }
    };

    const loop = () => {
      if (cancelled) return;
      playBeep();
      const p = clamp(proximityRef.current, 0, 100);
      const gap =
        BEEP_GAP_MAX_MS - ((BEEP_GAP_MAX_MS - BEEP_GAP_MIN_MS) * p) / 100;
      timer = window.setTimeout(loop, BEEP_PULSE_MS + gap);
    };
    loop();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      void ctx.close().catch(() => undefined);
    };
  }, [active]);
}
