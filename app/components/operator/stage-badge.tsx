import type { Stage } from "../../../db/schema";

const STAGE_STYLE: Record<Stage, { bg: string; text: string; label: string }> =
  {
    START: { bg: "bg-gray-100", text: "text-gray-700", label: "未開始" },
    Q1: { bg: "bg-blue-50", text: "text-blue-700", label: "Q1" },
    Q2: { bg: "bg-indigo-50", text: "text-indigo-700", label: "Q2" },
    Q3_KEYWORD: { bg: "bg-violet-50", text: "text-violet-700", label: "Q3-K" },
    Q3_CODE: { bg: "bg-violet-50", text: "text-violet-700", label: "Q3-C" },
    Q4: { bg: "bg-pink-50", text: "text-pink-700", label: "Q4" },
    FAKE_END: { bg: "bg-amber-50", text: "text-amber-700", label: "偽End" },
    COMPLETE: { bg: "bg-emerald-50", text: "text-emerald-700", label: "完了" },
  };

export function StageBadge({ stage }: { stage: Stage }) {
  const style = STAGE_STYLE[stage] ?? {
    bg: "bg-gray-100",
    text: "text-gray-700",
    label: stage,
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${style.bg} ${style.text}`}
      title={stage}
    >
      {style.label}
    </span>
  );
}
