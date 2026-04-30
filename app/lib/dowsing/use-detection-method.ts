import { useCallback, useEffect, useState } from "react";
import { DEFAULT_DETECTION_METHOD, type DetectionMethod } from "./config";

const STORAGE_KEY = "dowsing.detection_method";
const EVENT_NAME = "dowsing:method-changed";

function isDetectionMethod(v: unknown): v is DetectionMethod {
  return v === "peak" || v === "energy_sum";
}

function readStored(): DetectionMethod {
  if (typeof window === "undefined") return DEFAULT_DETECTION_METHOD;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isDetectionMethod(v)) return v;
  } catch {
    // localStorage 不可（プライベートモード等）。default にフォールバック。
  }
  return DEFAULT_DETECTION_METHOD;
}

function writeStored(method: DetectionMethod): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // 書込失敗は無視してイベントだけ飛ばす
  }
  window.dispatchEvent(new CustomEvent<DetectionMethod>(EVENT_NAME, { detail: method }));
}

/**
 * 検出方式（peak / energy_sum）の選択を localStorage と同期する hook。
 * 同一タブ内の他コンポーネントへは CustomEvent、他タブへは storage イベントで伝播する。
 */
export function useDetectionMethod(): [
  DetectionMethod,
  (m: DetectionMethod) => void,
] {
  const [method, setMethodState] = useState<DetectionMethod>(
    DEFAULT_DETECTION_METHOD,
  );

  useEffect(() => {
    setMethodState(readStored());

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<DetectionMethod>).detail;
      if (isDetectionMethod(detail)) setMethodState(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      if (isDetectionMethod(e.newValue)) setMethodState(e.newValue);
    };
    window.addEventListener(EVENT_NAME, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setMethod = useCallback((m: DetectionMethod) => {
    writeStored(m);
    setMethodState(m);
  }, []);

  return [method, setMethod];
}
