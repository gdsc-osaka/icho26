import { useEffect, useRef } from "react";
import { VIB_GAP_MAX_MS, VIB_GAP_MIN_MS, VIB_PULSE_MS, clamp } from "./config";

const RETRIGGER_MS = 500;

function isAndroidWithVibrate(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!("vibrate" in navigator)) return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * 接近度に応じてバイブレーションのパルス間隔を短縮する（Android のみ）。
 * 接近度が 0 のときは無振動に近い間隔。500ms ごとにパターンを再投入する。
 */
export function useHaptic(active: boolean, proximity: number) {
  const proximityRef = useRef(proximity);

  useEffect(() => {
    proximityRef.current = proximity;
  }, [proximity]);

  useEffect(() => {
    if (!active) return;
    if (!isAndroidWithVibrate()) return;

    const trigger = () => {
      const p = clamp(proximityRef.current, 0, 100);
      const gap =
        VIB_GAP_MAX_MS - ((VIB_GAP_MAX_MS - VIB_GAP_MIN_MS) * p) / 100;
      navigator.vibrate([VIB_PULSE_MS, gap, VIB_PULSE_MS, gap, VIB_PULSE_MS]);
    };

    trigger();
    const id = window.setInterval(trigger, RETRIGGER_MS);

    return () => {
      window.clearInterval(id);
      navigator.vibrate(0);
    };
  }, [active]);
}
