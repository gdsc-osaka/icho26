import { useState } from "react";

type ViewState = "idle" | "confirm" | "hint";

const FALLBACK_HINT =
  "イリスは現在復旧中です... もう少しお待ちください。";

type Props = {
  /** 設問ごとに固定で表示するヒント本文。 */
  hint?: string;
};

/**
 * 左下のヒントボタン → 閲覧確認モーダル → Iris の定型ヒント。
 * ヒント本文は設問ごとに props で固定値を渡す。
 */
export function HintChat({ hint = FALLBACK_HINT }: Props) {
  const [view, setView] = useState<ViewState>("idle");
  const close = () => setView("idle");

  return (
    <>
      <button
        type="button"
        aria-label="ヒントを開く"
        onClick={() => setView("confirm")}
        className="fixed bottom-4 left-4 z-40 rounded-full bg-bg-surface border border-accent text-accent font-mono text-xs px-4 py-3 shadow-[0_0_12px_var(--color-accent-dim)] hover:shadow-[0_0_20px_var(--color-accent)] transition-shadow"
      >
        ? HINT
      </button>

      {view !== "idle" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg-primary/60 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className="w-full max-w-md bg-bg-surface border-t border-accent-dim p-4 space-y-3 max-h-[70vh] overflow-y-auto sm:border sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-accent text-sm">
                {view === "confirm" ? "IRIS / CONFIRM" : "IRIS / HINT"}
              </p>
              <button
                type="button"
                aria-label="閉じる"
                onClick={close}
                className="text-text-secondary text-xs font-mono hover:text-accent"
              >
                CLOSE
              </button>
            </div>

            {view === "confirm" ? (
              <ConfirmBody
                onConfirm={() => setView("hint")}
                onCancel={close}
              />
            ) : (
              <HintBody hint={hint} />
            )}

            <p className="font-mono text-[10px] text-text-secondary leading-relaxed pt-2 border-t border-accent-dim/40">
              ヒントは設問ごとに固定で提供されます。
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmBody({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-sm text-text-primary leading-relaxed">
        <span className="text-text-secondary text-xs mr-2">iris&gt;</span>
        ヒントを表示しますか? 自力で挑戦したい場合はキャンセルしてください。
      </p>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 font-mono text-xs px-3 py-2 border border-accent-dim text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          CANCEL
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 font-mono text-xs px-3 py-2 border border-accent text-accent bg-accent/10 hover:bg-accent/20 transition-colors"
        >
          SHOW HINT
        </button>
      </div>
    </div>
  );
}

function HintBody({ hint }: { hint: string }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-mono leading-relaxed text-text-primary whitespace-pre-wrap">
        <span className="text-text-secondary text-xs mr-2">iris&gt;</span>
        {hint}
      </div>
    </div>
  );
}
