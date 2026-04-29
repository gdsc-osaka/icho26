import {
  MAX_DENSITY,
  MIN_DENSITY,
  type UsePrinterReturn,
} from "~/lib/printer/usePrinter";
import { GlowButton } from "./glow-button";

type Props = {
  printer: UsePrinterReturn;
  fontReady: boolean;
};

const DENSITY_LEVELS = Array.from(
  { length: MAX_DENSITY - MIN_DENSITY + 1 },
  (_, i) => MIN_DENSITY + i,
);

export function PrinterPanel({ printer, fontReady }: Readonly<Props>) {
  const {
    status,
    isConnecting,
    errorMessage,
    printState,
    density,
    connect,
    setDensity,
  } = printer;
  return (
    <div className="space-y-2 border border-cyan-900/60 bg-[#05070A]/80 p-3 font-mono text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status.isConnected ? "bg-cyan-400" : "bg-on-surface-variant"
            }`}
            aria-hidden
          />
          <span className="text-on-surface">
            LX-D02:{" "}
            <span
              className={
                status.isConnected ? "text-cyan-400" : "text-on-surface-variant"
              }
            >
              {status.isConnected ? "接続済み" : "未接続"}
            </span>
            {status.battery !== undefined && (
              <span className="ml-2 text-on-surface-variant">
                bat {status.battery}%
              </span>
            )}
          </span>
        </div>
        {!status.isConnected && (
          <GlowButton
            type="button"
            onClick={() => {
              void connect();
            }}
            disabled={isConnecting}
          >
            {isConnecting ? "接続中..." : "プリンタを接続"}
          </GlowButton>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-cyan-900">
          DENSITY
        </span>
        <div className="flex gap-1" role="radiogroup" aria-label="印刷濃度">
          {DENSITY_LEVELS.map((level) => {
            const selected = level === density;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDensity(level)}
                className={`h-7 w-7 border font-mono text-xs transition-colors ${
                  selected
                    ? "border-cyan-400 bg-cyan-400 text-surface-deep"
                    : "border-cyan-900/60 bg-[#05070A]/80 text-on-surface-variant hover:border-cyan-400 hover:text-on-surface"
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-on-surface-variant">
          (濃いほど印刷時間が伸びます)
        </span>
      </div>
      {!fontReady && (
        <p className="text-xs text-on-surface-variant">
          フォント (b16.bdf) をロード中…
        </p>
      )}
      {status.isOutOfPaper && (
        <p className="text-xs text-error">用紙切れです</p>
      )}
      {status.isOverheat && (
        <p className="text-xs text-error">ヘッド温度警告</p>
      )}
      {printState === "printing" && (
        <p className="text-xs text-cyan-400">印刷中...</p>
      )}
      {printState === "success" && (
        <p className="text-xs text-cyan-400">印刷完了</p>
      )}
      {printState === "error" && errorMessage && (
        <p className="break-all text-xs text-error">印刷失敗: {errorMessage}</p>
      )}
      {printState !== "error" && errorMessage && !status.isConnected && (
        <p className="break-all text-xs text-error">{errorMessage}</p>
      )}
    </div>
  );
}
