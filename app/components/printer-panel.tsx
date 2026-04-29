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

export function PrinterPanel({ printer, fontReady }: Props) {
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
    <div className="bg-bg-primary rounded p-3 font-mono text-sm space-y-2 border border-accent-dim">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              status.isConnected ? "bg-accent" : "bg-text-secondary"
            }`}
            aria-hidden
          />
          <span className="text-text-primary">
            LX-D02:{" "}
            <span
              className={status.isConnected ? "text-accent" : "text-text-secondary"}
            >
              {status.isConnected ? "接続済み" : "未接続"}
            </span>
            {status.battery !== undefined && (
              <span className="text-text-secondary ml-2">
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
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-text-secondary text-xs">印刷濃度</span>
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
                className={`w-7 h-7 rounded font-mono text-xs border transition-colors ${
                  selected
                    ? "bg-accent text-bg-primary border-accent"
                    : "bg-bg-primary text-text-secondary border-accent-dim hover:text-text-primary hover:border-accent"
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
        <span className="text-text-secondary text-xs">
          (濃いほど印刷時間が伸びます)
        </span>
      </div>
      {!fontReady && (
        <p className="text-text-secondary text-xs">
          フォント (b16.bdf) をロード中…
        </p>
      )}
      {status.isOutOfPaper && (
        <p className="text-danger text-xs">用紙切れです</p>
      )}
      {status.isOverheat && (
        <p className="text-danger text-xs">ヘッド温度警告</p>
      )}
      {printState === "printing" && (
        <p className="text-accent text-xs">印刷中...</p>
      )}
      {printState === "success" && (
        <p className="text-accent text-xs">印刷完了</p>
      )}
      {printState === "error" && errorMessage && (
        <p className="text-danger text-xs break-all">印刷失敗: {errorMessage}</p>
      )}
      {printState !== "error" && errorMessage && !status.isConnected && (
        <p className="text-danger text-xs break-all">{errorMessage}</p>
      )}
    </div>
  );
}
