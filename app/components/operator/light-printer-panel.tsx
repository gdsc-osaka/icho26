import {
  MAX_DENSITY,
  MIN_DENSITY,
  type UsePrinterReturn,
} from "~/lib/printer/usePrinter";
import { Icon } from "../icon";

type Props = {
  printer: UsePrinterReturn;
  assetsReady: boolean;
};

const DENSITY_LEVELS = Array.from(
  { length: MAX_DENSITY - MIN_DENSITY + 1 },
  (_, i) => MIN_DENSITY + i,
);

/**
 * Light-themed wrapper around the same `usePrinter` state used by the dark
 * `PrinterPanel`. Functionality is identical (connect / setDensity / status).
 */
export function LightPrinterPanel({ printer, assetsReady }: Readonly<Props>) {
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
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status.isConnected ? "bg-emerald-500" : "bg-gray-400"
            }`}
            aria-hidden
          />
          <span className="font-medium text-gray-900">LX-D02:</span>
          <span
            className={
              status.isConnected ? "text-emerald-700" : "text-gray-500"
            }
          >
            {status.isConnected ? "接続済み" : "未接続"}
          </span>
          {status.battery !== undefined && (
            <span className="text-xs text-gray-500">bat {status.battery}%</span>
          )}
        </div>
        {!status.isConnected && (
          <button
            type="button"
            onClick={() => {
              void connect();
            }}
            disabled={isConnecting}
            className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="bluetooth" className="text-sm" />
            {isConnecting ? "接続中..." : "プリンタを接続"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
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
                className={`h-7 w-7 rounded border font-mono text-xs transition-colors ${
                  selected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-gray-500">
          (濃いほど印刷時間が伸びます)
        </span>
      </div>

      {!assetsReady && (
        <p className="text-xs text-gray-500">
          社員証アセット (背景・フォント) をロード中…
        </p>
      )}
      {status.isOutOfPaper && (
        <p className="text-xs text-red-600">用紙切れです</p>
      )}
      {status.isOverheat && (
        <p className="text-xs text-red-600">ヘッド温度警告</p>
      )}
      {printState === "printing" && (
        <p className="text-xs text-blue-600">印刷中...</p>
      )}
      {printState === "success" && (
        <p className="text-xs text-emerald-600">印刷完了</p>
      )}
      {printState === "error" && errorMessage && (
        <p className="break-all text-xs text-red-600">
          印刷失敗: {errorMessage}
        </p>
      )}
      {printState !== "error" && errorMessage && !status.isConnected && (
        <p className="break-all text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
