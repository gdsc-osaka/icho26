import { useEffect, useRef } from "react";
import {
  HISTORY_DURATION_MS,
  type HistoryBuffers,
} from "~/lib/dowsing/use-proximity";

type Props = {
  /** 受信機 hook が返す getHistory。out に時刻昇順でサンプルを書き込む */
  getHistory: (out: HistoryBuffers) => number;
  /** リングバッファの容量。consumer はこれと同サイズの Float32Array を確保する */
  historyCapacity: number;
  /** 表示中フラグ。false のとき RAF を回さない */
  active: boolean;
  /** 強調する方式。透明度を上げる */
  highlight?: "peak" | "energy_sum";
  /** 表示窓の長さ（ms）。既定は HISTORY_DURATION_MS */
  windowMs?: number;
  /** Y 軸の最低保証 (dB) */
  minYMaxDb?: number;
  /** Y 軸の天井ヘッドルーム比率 */
  yHeadroom?: number;
  /** 縦軸縮小の減衰速度（dB / sec） */
  yMaxDecayPerSec?: number;
  className?: string;
};

const DEFAULT_MIN_YMAX_DB = 5;
const DEFAULT_HEADROOM = 1.15;
const DEFAULT_DECAY_PER_SEC = 6;

const COLOR_PEAK = "#d97706"; // amber-600
const COLOR_ENERGY = "#059669"; // emerald-600

/**
 * signalDb の時系列を Task Manager 風に描画する canvas。
 * - X 軸: 直近 windowMs の時間。右端 = 現在
 * - Y 軸: 直近の最大値に追従して自動スケール（即時上昇 / 緩やか減少）
 * - peak / energy_sum を 2 本の折れ線で同時表示
 */
export function DowsingTimeChart({
  getHistory,
  historyCapacity,
  active,
  highlight,
  windowMs = HISTORY_DURATION_MS,
  minYMaxDb = DEFAULT_MIN_YMAX_DB,
  yHeadroom = DEFAULT_HEADROOM,
  yMaxDecayPerSec = DEFAULT_DECAY_PER_SEC,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Float32Array は呼ばれるたびに作らず使い回す。capacity 変更時のみ effect 内で再確保
  const bufRef = useRef<HistoryBuffers>({
    time: new Float32Array(historyCapacity),
    peakDb: new Float32Array(historyCapacity),
    energyDb: new Float32Array(historyCapacity),
  });

  // Y 軸スケールの内部状態（描画ループ間で持続）
  const yMaxRef = useRef(minYMaxDb);
  const lastFrameRef = useRef<number>(0);

  useEffect(() => {
    if (bufRef.current.time.length !== historyCapacity) {
      bufRef.current = {
        time: new Float32Array(historyCapacity),
        peakDb: new Float32Array(historyCapacity),
        energyDb: new Float32Array(historyCapacity),
      };
    }
  }, [historyCapacity]);

  useEffect(() => {
    if (!active) {
      // 非表示時はスケールリセット
      yMaxRef.current = minYMaxDb;
      lastFrameRef.current = 0;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const setupBackingStore = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || 600;
      const cssH = canvas.clientHeight || 160;
      const wantW = Math.floor(cssW * dpr);
      const wantH = Math.floor(cssH * dpr);
      if (canvas.width !== wantW || canvas.height !== wantH) {
        canvas.width = wantW;
        canvas.height = wantH;
      }
      return { dpr, cssW, cssH };
    };

    let raf: number | null = null;

    const draw = (now: number) => {
      const { dpr, cssW, cssH } = setupBackingStore();
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, cssW, cssH);

      // background
      ctx2d.fillStyle = "#fafafa";
      ctx2d.fillRect(0, 0, cssW, cssH);

      const buf = bufRef.current;
      const count = getHistory(buf);

      // Y 軸スケール: 観測最大値 × ヘッドルーム、最低 minYMaxDb
      let observedMax = 0;
      for (let i = 0; i < count; i++) {
        const a = buf.peakDb[i];
        const b = buf.energyDb[i];
        if (a > observedMax) observedMax = a;
        if (b > observedMax) observedMax = b;
      }
      const targetYMax = Math.max(minYMaxDb, observedMax * yHeadroom);
      // 即時上昇 / 緩やか減少
      if (targetYMax >= yMaxRef.current) {
        yMaxRef.current = targetYMax;
      } else if (lastFrameRef.current > 0) {
        const dt = (now - lastFrameRef.current) / 1000;
        yMaxRef.current = Math.max(
          targetYMax,
          yMaxRef.current - yMaxDecayPerSec * dt,
        );
      } else {
        yMaxRef.current = targetYMax;
      }
      lastFrameRef.current = now;
      const yMax = yMaxRef.current;

      // 時間軸: 現在から windowMs 前まで
      const tEnd = count > 0 ? buf.time[count - 1] : now;
      const tStart = tEnd - windowMs;

      const xForTime = (t: number): number => {
        const r = (t - tStart) / windowMs;
        return r * cssW;
      };
      const yForDb = (db: number): number => {
        const r = Math.max(0, Math.min(1, db / yMax));
        return cssH - r * cssH;
      };

      // 横グリッド: dB 段（5 本程度）
      ctx2d.strokeStyle = "#e5e7eb"; // gray-200
      ctx2d.fillStyle = "#9ca3af"; // gray-400
      ctx2d.lineWidth = 1;
      ctx2d.font = "10px ui-monospace, monospace";
      const stepDb = niceStep(yMax / 4);
      for (let db = 0; db <= yMax; db += stepDb) {
        const y = yForDb(db);
        ctx2d.beginPath();
        ctx2d.moveTo(0, y);
        ctx2d.lineTo(cssW, y);
        ctx2d.stroke();
        if (db > 0) {
          ctx2d.fillText(`${db.toFixed(0)}dB`, 4, y - 2);
        }
      }

      // 縦グリッド: 5 秒刻み（時間ラベル）
      ctx2d.fillStyle = "#9ca3af";
      const gridStepMs = 5000;
      // tEnd を基準に 5 秒刻みでマーカー
      const firstGrid = Math.ceil(tStart / gridStepMs) * gridStepMs;
      for (let t = firstGrid; t <= tEnd; t += gridStepMs) {
        const x = xForTime(t);
        ctx2d.strokeStyle = "#f3f4f6"; // gray-100
        ctx2d.beginPath();
        ctx2d.moveTo(x, 0);
        ctx2d.lineTo(x, cssH);
        ctx2d.stroke();
        const secondsAgo = (tEnd - t) / 1000;
        if (secondsAgo > 0.5) {
          ctx2d.fillText(`-${secondsAgo.toFixed(0)}s`, x + 2, cssH - 2);
        }
      }

      // Y_max 表示（右上）
      ctx2d.fillStyle = "#374151"; // gray-700
      ctx2d.font = "11px ui-monospace, monospace";
      const ymLabel = `MAX ${yMax.toFixed(1)} dB`;
      const tw = ctx2d.measureText(ymLabel).width;
      ctx2d.fillStyle = "rgba(255,255,255,0.85)";
      ctx2d.fillRect(cssW - tw - 8, 2, tw + 6, 14);
      ctx2d.fillStyle = "#374151";
      ctx2d.fillText(ymLabel, cssW - tw - 5, 13);

      if (count >= 2) {
        const drawSeries = (
          values: Float32Array,
          color: string,
          alpha: number,
        ) => {
          ctx2d.beginPath();
          ctx2d.strokeStyle = color;
          ctx2d.globalAlpha = alpha;
          ctx2d.lineWidth = 1.5;
          for (let i = 0; i < count; i++) {
            const x = xForTime(buf.time[i]);
            const y = yForDb(values[i]);
            if (i === 0) ctx2d.moveTo(x, y);
            else ctx2d.lineTo(x, y);
          }
          ctx2d.stroke();
          ctx2d.globalAlpha = 1;
        };
        const peakAlpha = highlight === "peak" ? 1 : 0.55;
        const energyAlpha = highlight === "energy_sum" ? 1 : 0.55;
        drawSeries(buf.peakDb, COLOR_PEAK, peakAlpha);
        drawSeries(buf.energyDb, COLOR_ENERGY, energyAlpha);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [
    active,
    getHistory,
    highlight,
    minYMaxDb,
    windowMs,
    yHeadroom,
    yMaxDecayPerSec,
  ]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="block h-40 w-full rounded-md border border-gray-200 bg-gray-50"
      />
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-1 w-3 rounded-sm"
            style={{ backgroundColor: COLOR_PEAK }}
          />
          peak signalDb
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-1 w-3 rounded-sm"
            style={{ backgroundColor: COLOR_ENERGY }}
          />
          energy_sum signalDb
        </span>
        <span>右端=現在 / 左端=
          {Math.round(windowMs / 1000)}秒前</span>
      </div>
    </div>
  );
}

/**
 * 軸目盛として読みやすいステップ値（1, 2, 5, 10, 20, 50, ...）に丸める。
 */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const m = raw / base;
  if (m < 1.5) return 1 * base;
  if (m < 3.5) return 2 * base;
  if (m < 7.5) return 5 * base;
  return 10 * base;
}
