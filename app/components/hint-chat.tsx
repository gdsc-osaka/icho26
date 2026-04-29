import { useState } from "react";
import { Icon } from "./icon";

type ViewState = "idle" | "confirm" | "hint";

const FALLBACK_HINT = "イリスは現在復旧中です... もう少しお待ちください。";

type Props = {
  hint?: string;
};

export function HintChat({ hint = FALLBACK_HINT }: Props) {
  const [view, setView] = useState<ViewState>("idle");
  const close = () => setView("idle");

  return (
    <>
      <button
        type="button"
        aria-label="ヒントを開く"
        onClick={() => setView("confirm")}
        className="fixed bottom-6 left-4 z-40 flex items-center gap-2 border border-cyan-400 bg-[#05070A]/80 px-4 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.25)] backdrop-blur hover:bg-cyan-500/10"
      >
        <Icon name="help" className="text-sm" />
        HINT
      </button>

      {view !== "idle" && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#05070A]/70 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className="relative w-full max-w-md border border-cyan-900/70 bg-[#05070A]/95 p-5 sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="pointer-events-none absolute -top-px -left-px h-2 w-2 border-t border-l border-cyan-400" />
            <span className="pointer-events-none absolute -top-px -right-px h-2 w-2 border-t border-r border-cyan-400" />
            <span className="pointer-events-none absolute -bottom-px -left-px h-2 w-2 border-b border-l border-cyan-400" />
            <span className="pointer-events-none absolute -bottom-px -right-px h-2 w-2 border-b border-r border-cyan-400" />

            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-xs font-bold uppercase tracking-widest text-cyan-400">
                IRIS // {view === "confirm" ? "CONFIRM" : "HINT"}
              </p>
              <button
                type="button"
                aria-label="閉じる"
                onClick={close}
                className="font-mono text-xs uppercase text-on-surface-variant hover:text-cyan-400"
              >
                CLOSE
              </button>
            </div>

            {view === "confirm" ? (
              <ConfirmBody onConfirm={() => setView("hint")} onCancel={close} />
            ) : (
              <HintBody hint={hint} />
            )}

            <p className="mt-3 border-t border-cyan-900/50 pt-2 font-mono text-[10px] leading-relaxed text-cyan-900">
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
      <p className="font-mono text-sm leading-relaxed text-on-surface">
        <span className="mr-2 text-cyan-500">iris&gt;</span>
        ヒントを表示しますか? 自力で挑戦したい場合はキャンセルしてください。
      </p>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-cyan-900/60 px-3 py-2 font-mono text-xs uppercase tracking-widest text-on-surface-variant hover:border-cyan-400 hover:text-cyan-400"
        >
          CANCEL
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 border border-cyan-400 bg-cyan-500/10 px-3 py-2 font-mono text-xs uppercase tracking-widest text-cyan-400 hover:bg-cyan-500/20"
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
      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-on-surface">
        <span className="mr-2 text-cyan-500">iris&gt;</span>
        {hint}
      </div>
    </div>
  );
}
