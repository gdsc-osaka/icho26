import { Icon } from "../icon";

type Props = {
  icon: string;
  label: string;
  value: string | number;
  /** Sub-line displayed below the value (small, gray). */
  hint?: string;
  /** Optional accent color class for the value. */
  accent?: "default" | "success" | "warning" | "info";
};

const ACCENT: Record<NonNullable<Props["accent"]>, string> = {
  default: "text-gray-900",
  success: "text-emerald-600",
  warning: "text-amber-600",
  info: "text-blue-600",
};

export function StatCard({
  icon,
  label,
  value,
  hint,
  accent = "default",
}: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          {label}
        </span>
        <Icon name={icon} className="text-base text-gray-400" />
      </div>
      <div className={`mt-2 text-2xl font-semibold ${ACCENT[accent]}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 font-mono text-[10px] text-gray-500">{hint}</div>
      )}
    </div>
  );
}
