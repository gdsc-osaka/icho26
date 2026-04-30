import { useEffect, useRef } from "react";
import {
  HISTORY_DURATION_MS,
  type HistoryBuffers,
} from "~/lib/dowsing/use-proximity";

export type DowsingTimeChartTheme = "light" | "cyber";

export type SeriesVisibility = {
  peak?: boolean;
  energy?: boolean;
  diff?: boolean;
};

type Props = {
  /** 受信機 hook が返す getHistory。out に時刻昇順でサンプルを書き込む */
  getHistory: (out: HistoryBuffers) => number;
  /** リングバッファの容量。consumer はこれと同サイズの Float32Array を確保する */
  historyCapacity: number;
  /** 表示中フラグ。false のとき RAF を回さない */
  active: boolean;
  /** 配色テーマ。"light"=operator、"cyber"=参加者画面 */
  theme?: DowsingTimeChartTheme;
  /** 表示する系列の選択。未指定キーは false 扱い */
  showSeries?: SeriesVisibility;
  /** 強調する方式（α アップ）。light テーマで意味を持つ */
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

type ChartColors = {
  background: string;
  gridMajor: string;
  gridMinor: string;
  axisLabel: string;
  zeroLine: string;
  zeroLabel: string;
  yMaxBg: string;
  yMaxText: string;
  peak: string;
  peakGlow: string | null;
  energy: string;
  diff: string;
};

const LIGHT_COLORS: ChartColors = {
  background: "#fafafa",
  gridMajor: "#e5e7eb", // gray-200
  gridMinor: "#f3f4f6", // gray-100
  axisLabel: "#9ca3af", // gray-400
  zeroLine: "#9ca3af",
  zeroLabel: "#6b7280", // gray-500
  yMaxBg: "rgba(255,255,255,0.85)",
  yMaxText: "#374151", // gray-700
  peak: "#d97706", // amber-600
  peakGlow: null,
  energy: "#059669", // emerald-600
  diff: "#4f46e5", // indigo-600
};

const CYBER_COLORS: ChartColors = {
  background: "rgba(5, 7, 10, 0.6)",
  gridMajor: "rgba(34, 211, 238, 0.10)", // cyan-400 @ 10%
  gridMinor: "rgba(34, 211, 238, 0.04)",
  axisLabel: "rgba(6, 182, 212, 0.65)", // cyan-500 @ 65%
  zeroLine: "rgba(34, 211, 238, 0.45)",
  zeroLabel: "rgba(34, 211, 238, 0.7)",
  yMaxBg: "rgba(5, 7, 10, 0.85)",
  yMaxText: "#22d3ee", // cyan-400
  peak: "#22d3ee", // cyan-400
  peakGlow: "rgba(0, 240, 255, 0.6)",
  energy: "#5eead4", // teal-300
  diff: "#a78bfa", // violet-400
};

const FULL_SERIES: SeriesVisibility = { peak: true, energy: true, diff: true };

/**
 * signalDb の時系列を Task Manager 風に描画する canvas。
 * - X 軸: 直近 windowMs の時間。右端 = 現在
 * - Y 軸: 直近の最大値に追従して自動スケール（即時上昇 / 緩やか減少）
 * - showSeries で表示する折れ線を選択（peak / energy / diff）
 */
export function DowsingTimeChart({
  getHistory,
  historyCapacity,
  active,
  theme = "light",
  showSeries,
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

  const colors = theme === "cyber" ? CYBER_COLORS : LIGHT_COLORS;
  const visibility: SeriesVisibility = showSeries ?? FULL_SERIES;
  const showPeak = visibility.peak === true;
  const showEnergy = visibility.energy === true;
  const showDiff = visibility.diff === true;
  const visibleSeriesCount =
    (showPeak ? 1 : 0) + (showEnergy ? 1 : 0) + (showDiff ? 1 : 0);

  useEffect(() => {
    if (!active) {
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

      ctx2d.fillStyle = colors.background;
      ctx2d.fillRect(0, 0, cssW, cssH);

      const buf = bufRef.current;
      const count = getHistory(buf);

      // Y 軸スケール: 観測最大値 × ヘッドルーム、最低 minYMaxDb
      let observedMax = 0;
      let observedMin = 0;
      for (let i = 0; i < count; i++) {
        const a = buf.peakDb[i];
        const b = buf.energyDb[i];
        if (showPeak && a > observedMax) observedMax = a;
        if (showEnergy && b > observedMax) observedMax = b;
        if (showDiff) {
          const d = a - b;
          if (d > observedMax) observedMax = d;
          if (d < observedMin) observedMin = d;
        }
      }
      const targetYMax = Math.max(minYMaxDb, observedMax * yHeadroom);
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
      const yMin = Math.min(0, observedMin * yHeadroom);

      const tEnd = count > 0 ? buf.time[count - 1] : now;
      const tStart = tEnd - windowMs;

      const xForTime = (t: number): number => ((t - tStart) / windowMs) * cssW;
      const yForDb = (db: number): number => {
        const r = (db - yMin) / (yMax - yMin);
        const clamped = Math.max(0, Math.min(1, r));
        return cssH - clamped * cssH;
      };

      // 横グリッド (dB)
      ctx2d.strokeStyle = colors.gridMajor;
      ctx2d.fillStyle = colors.axisLabel;
      ctx2d.lineWidth = 1;
      ctx2d.font = "10px ui-monospace, monospace";
      const stepDb = niceStep((yMax - yMin) / 4);
      const startDb = Math.ceil(yMin / stepDb) * stepDb;
      for (let db = startDb; db <= yMax; db += stepDb) {
        const y = yForDb(db);
        ctx2d.beginPath();
        ctx2d.moveTo(0, y);
        ctx2d.lineTo(cssW, y);
        ctx2d.stroke();
        if (db !== 0) {
          ctx2d.fillText(`${db.toFixed(0)}dB`, 4, y - 2);
        }
      }
      if (yMin < 0) {
        const y0 = yForDb(0);
        ctx2d.strokeStyle = colors.zeroLine;
        ctx2d.beginPath();
        ctx2d.moveTo(0, y0);
        ctx2d.lineTo(cssW, y0);
        ctx2d.stroke();
        ctx2d.fillStyle = colors.zeroLabel;
        ctx2d.fillText("0dB", 4, y0 - 2);
      }

      // 縦グリッド (時間)
      ctx2d.fillStyle = colors.axisLabel;
      const gridStepMs = 5000;
      const firstGrid = Math.ceil(tStart / gridStepMs) * gridStepMs;
      for (let t = firstGrid; t <= tEnd; t += gridStepMs) {
        const x = xForTime(t);
        ctx2d.strokeStyle = colors.gridMinor;
        ctx2d.beginPath();
        ctx2d.moveTo(x, 0);
        ctx2d.lineTo(x, cssH);
        ctx2d.stroke();
        const secondsAgo = (tEnd - t) / 1000;
        if (secondsAgo > 0.5) {
          ctx2d.fillText(`-${secondsAgo.toFixed(0)}s`, x + 2, cssH - 2);
        }
      }

      // Y_max ラベル
      ctx2d.font = "11px ui-monospace, monospace";
      const ymLabel = `MAX ${yMax.toFixed(1)} dB`;
      const tw = ctx2d.measureText(ymLabel).width;
      ctx2d.fillStyle = colors.yMaxBg;
      ctx2d.fillRect(cssW - tw - 8, 2, tw + 6, 14);
      ctx2d.fillStyle = colors.yMaxText;
      ctx2d.fillText(ymLabel, cssW - tw - 5, 13);

      if (count >= 2) {
        const drawSeries = (
          values: Float32Array,
          color: string,
          alpha: number,
          options?: { dashed?: boolean; glow?: string | null },
        ) => {
          ctx2d.beginPath();
          ctx2d.strokeStyle = color;
          ctx2d.globalAlpha = alpha;
          ctx2d.lineWidth = 1.5;
          ctx2d.setLineDash(options?.dashed ? [4, 3] : []);
          if (options?.glow) {
            ctx2d.shadowColor = options.glow;
            ctx2d.shadowBlur = 6;
          }
          for (let i = 0; i < count; i++) {
            const x = xForTime(buf.time[i]);
            const y = yForDb(values[i]);
            if (i === 0) ctx2d.moveTo(x, y);
            else ctx2d.lineTo(x, y);
          }
          ctx2d.stroke();
          ctx2d.setLineDash([]);
          ctx2d.shadowBlur = 0;
          ctx2d.globalAlpha = 1;
        };

        const peakAlpha = highlight === "peak" ? 1 : 0.7;
        const energyAlpha = highlight === "energy_sum" ? 1 : 0.7;
        if (showPeak) {
          drawSeries(buf.peakDb, colors.peak, peakAlpha, {
            glow: colors.peakGlow,
          });
        }
        if (showEnergy) {
          drawSeries(buf.energyDb, colors.energy, energyAlpha);
        }
        if (showDiff) {
          const diff = new Float32Array(count);
          for (let i = 0; i < count; i++) {
            diff[i] = buf.peakDb[i] - buf.energyDb[i];
          }
          drawSeries(diff, colors.diff, 0.85, { dashed: true });
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [
    active,
    colors,
    getHistory,
    highlight,
    minYMaxDb,
    showDiff,
    showEnergy,
    showPeak,
    windowMs,
    yHeadroom,
    yMaxDecayPerSec,
  ]);

  const showLegend = !(theme === "cyber" && visibleSeriesCount <= 1);
  const canvasClass =
    theme === "cyber"
      ? "block h-32 w-full bg-transparent"
      : "block h-40 w-full rounded-md border border-gray-200 bg-gray-50";

  return (
    <div className={className}>
      <canvas ref={canvasRef} className={canvasClass} />
      {showLegend && (
        <div
          className={`mt-1 flex flex-wrap items-center gap-3 text-[10px] ${
            theme === "cyber" ? "text-cyan-500/70" : "text-gray-500"
          }`}
        >
          {showPeak && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-1 w-3 rounded-sm"
                style={{ backgroundColor: colors.peak }}
              />
              peak signalDb
            </span>
          )}
          {showEnergy && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-1 w-3 rounded-sm"
                style={{ backgroundColor: colors.energy }}
              />
              energy_sum signalDb
            </span>
          )}
          {showDiff && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-1 w-3 rounded-sm"
                style={{
                  background: `repeating-linear-gradient(90deg, ${colors.diff} 0 4px, transparent 4px 7px)`,
                }}
              />
              diff (peak − energy)
            </span>
          )}
          <span>
            右端=現在 / 左端={Math.round(windowMs / 1000)}秒前
          </span>
        </div>
      )}
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
