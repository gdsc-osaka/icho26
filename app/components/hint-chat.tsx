import { useState } from "react";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content: "イリスは現在復旧中です... もう少しお待ちください。",
  },
];

type Props = {
  messages?: ChatMessage[];
};

/**
 * Mock hint chat. Fixed-position trigger + slide-in panel. Designed to be
 * swapped for an LLM-backed chat by passing live `messages` via props
 * (per spec 03 §7).
 */
export function HintChat({ messages = DEFAULT_MESSAGES }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="ヒントを開く"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-full bg-bg-surface border border-accent text-accent font-mono text-xs px-4 py-3 shadow-[0_0_12px_var(--color-accent-dim)] hover:shadow-[0_0_20px_var(--color-accent)] transition-shadow"
      >
        ? HINT
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg-primary/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-bg-surface border-t border-accent-dim p-4 space-y-3 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-accent text-sm">IRIS / HINT</p>
              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setOpen(false)}
                className="text-text-secondary text-xs font-mono hover:text-accent"
              >
                CLOSE
              </button>
            </div>
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`text-sm font-mono leading-relaxed ${
                    m.role === "assistant"
                      ? "text-text-primary"
                      : "text-accent"
                  }`}
                >
                  <span className="text-text-secondary text-xs mr-2">
                    {m.role === "assistant" ? "iris>" : "you>"}
                  </span>
                  {m.content}
                </div>
              ))}
            </div>
            <p className="font-mono text-[10px] text-text-secondary leading-relaxed pt-2 border-t border-accent-dim/40">
              チャット欄では個人情報を入力しないでください。
            </p>
          </div>
        </div>
      )}
    </>
  );
}
