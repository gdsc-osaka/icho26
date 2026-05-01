import { useEffect, useRef } from "react";
import {
  ENERGY_HALF_BINS,
  FFT_SIZE,
  PEAK_BAND_HALF_HZ,
} from "~/lib/dowsing/config";

type Props = {
  /** 受信機 hook が返す getSpectrum。out (Float32Array, dB) を埋める */
  getSpectrum: (out: Float32Array) => boolean;
  /** AudioContext のサンプルレート（Hz）。0 のときは描画しない */
  sampleRate: number;
  /** 中心周波数（Hz） */
  targetFreqHz: number;
  /** 表示窓幅（target ± この値）。既定 ±2 kHz */
  windowHz?: number;
  /** dB 軸下限・上限（描画スケール） */
  dbMin?: number;
  dbMax?: number;
  /** 表示中フラグ。false のとき RAF を回さない */
  active: boolean;
  className?: string;
};

const DEFAULT_WINDOW_HZ = 2000;
const DEFAULT_DB_MIN = -110;
const DEFAULT_DB_MAX = -10;

/**
 * AnalyserNode の周波数スペクトルを target 周辺にフォーカスして描画する canvas。
 * - 緑帯: energy_sum 方式の解析帯域
 * - 黄帯: peak 方式の解析帯域
 * - 赤の縦線: target 周波数
 * - シアンの折れ線: 現在のスペクトル（dB）
 */
export function DowsingSpectrumChart({
  getSpectrum,
  sampleRate,
  targetFreqHz,
  windowHz = DEFAULT_WINDOW_HZ,
  dbMin = DEFAULT_DB_MIN,
  dbMax = DEFAULT_DB_MAX,
  active,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufRef = useRef<Float32Array>(new Float32Array(FFT_SIZE / 2));

  useEffect(() => {
    if (!active || sampleRate <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    // DPR スケール（毎回サイズが変わったらバッファ調整）
    const setupBackingStore = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || 600;
      const cssH = canvas.clientHeight || 180;
      const wantW = Math.floor(cssW * dpr);
      const wantH = Math.floor(cssH * dpr);
      if (canvas.width !== wantW || canvas.height !== wantH) {
        canvas.width = wantW;
        canvas.height = wantH;
      }
      return { dpr, cssW, cssH };
    };

    const binHz = sampleRate / FFT_SIZE;
    const binCount = FFT_SIZE / 2;
    const lowHz = Math.max(0, targetFreqHz - windowHz);
    const highHz = Math.min(sampleRate / 2, targetFreqHz + windowHz);
    const loBin = Math.max(0, Math.floor(lowHz / binHz));
    const hiBin = Math.min(binCount - 1, Math.ceil(highHz / binHz));

    const peakHalfBins = Math.max(1, Math.round(PEAK_BAND_HALF_HZ / binHz));
    const energyHalfBins = Math.max(1, ENERGY_HALF_BINS);
    const centerBin = Math.round(targetFreqHz / binHz);

    const xForBin = (bin: number, cssW: number) => {
      const span = hiBin - loBin || 1;
      return ((bin - loBin) / span) * cssW;
    };
    const yForDb = (db: number, cssH: number) => {
      const t = (db - dbMin) / (dbMax - dbMin);
      const clamped = Math.max(0, Math.min(1, t));
      return cssH - clamped * cssH;
    };

    // バッファサイズが変わっていたら作り直す
    if (bufRef.current.length !== binCount) {
      bufRef.current = new Float32Array(binCount);
    }

    let raf: number | null = null;
    const draw = () => {
      const { dpr, cssW, cssH } = setupBackingStore();
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, cssW, cssH);

      // background
      ctx2d.fillStyle = "#fafafa";
      ctx2d.fillRect(0, 0, cssW, cssH);

      // dB 水平グリッド (20dB 刻み)
      ctx2d.strokeStyle = "#e5e7eb"; // gray-200
      ctx2d.lineWidth = 1;
      ctx2d.fillStyle = "#9ca3af"; // gray-400
      ctx2d.font = "10px ui-monospace, monospace";
      for (let db = Math.ceil(dbMin / 20) * 20; db <= dbMax; db += 20) {
        const y = yForDb(db, cssH);
        ctx2d.beginPath();
        ctx2d.moveTo(0, y);
        ctx2d.lineTo(cssW, y);
        ctx2d.stroke();
        ctx2d.fillText(`${db}dB`, 4, y - 2);
      }

      // 帯域オーバーレイ: peak (黄), energy (緑)
      const drawBand = (
        loB: number,
        hiB: number,
        fill: string,
        stroke: string,
      ) => {
        const x1 = xForBin(Math.max(loBin, loB), cssW);
        const x2 = xForBin(Math.min(hiBin, hiB), cssW);
        ctx2d.fillStyle = fill;
        ctx2d.fillRect(x1, 0, Math.max(1, x2 - x1), cssH);
        ctx2d.strokeStyle = stroke;
        ctx2d.lineWidth = 1;
        ctx2d.strokeRect(x1, 0, Math.max(1, x2 - x1), cssH);
      };
      drawBand(
        centerBin - peakHalfBins,
        centerBin + peakHalfBins,
        "rgba(251, 191, 36, 0.10)", // amber-400 @ 10%
        "rgba(217, 119, 6, 0.4)", // amber-600
      );
      drawBand(
        centerBin - energyHalfBins,
        centerBin + energyHalfBins,
        "rgba(16, 185, 129, 0.18)", // emerald-500 @ 18%
        "rgba(5, 150, 105, 0.6)", // emerald-600
      );

      // target frequency 縦線
      const targetX = xForBin(centerBin, cssW);
      ctx2d.strokeStyle = "rgba(220, 38, 38, 0.8)"; // red-600
      ctx2d.setLineDash([3, 3]);
      ctx2d.beginPath();
      ctx2d.moveTo(targetX, 0);
      ctx2d.lineTo(targetX, cssH);
      ctx2d.stroke();
      ctx2d.setLineDash([]);
      ctx2d.fillStyle = "rgba(220, 38, 38, 0.9)";
      ctx2d.fillText(`${(targetFreqHz / 1000).toFixed(2)}k`, targetX + 3, 12);

      // 周波数軸ラベル（端と中央）
      ctx2d.fillStyle = "#6b7280"; // gray-500
      ctx2d.fillText(`${(lowHz / 1000).toFixed(1)}k`, 2, cssH - 2);
      const rightLabel = `${(highHz / 1000).toFixed(1)}k`;
      ctx2d.fillText(rightLabel, cssW - 30, cssH - 2);

      // スペクトル本体
      const ok = getSpectrum(bufRef.current);
      if (ok) {
        ctx2d.beginPath();
        ctx2d.strokeStyle = "#0891b2"; // cyan-600
        ctx2d.lineWidth = 1.5;
        const buf = bufRef.current;
        let started = false;
        for (let i = loBin; i <= hiBin; i++) {
          const v = buf[i];
          if (v === undefined || !Number.isFinite(v)) continue;
          const x = xForBin(i, cssW);
          const y = yForDb(v, cssH);
          if (!started) {
            ctx2d.moveTo(x, y);
            started = true;
          } else {
            ctx2d.lineTo(x, y);
          }
        }
        ctx2d.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [active, getSpectrum, sampleRate, targetFreqHz, windowHz, dbMin, dbMax]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="block h-44 w-full rounded-md border border-gray-200 bg-gray-50"
      />
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-200" />
          Energy Sum 帯域
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-amber-200" />
          Peak 帯域
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-red-400" />
          target
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-3 rounded-sm bg-cyan-600" />
          スペクトル
        </span>
      </div>
    </div>
  );
}
