type BarItem = {
  label: string;
  value: number;
  /** Tailwind background color class for the bar fill. */
  color?: string;
};

type Props = {
  items: BarItem[];
  /** If provided, used as the 100% reference. Defaults to max value across items. */
  max?: number;
  /** Optional unit string appended to each value. */
  unit?: string;
};

/**
 * Pure-CSS horizontal bar chart. No dependencies, accessible via aria-label on each bar.
 */
export function BarChart({ items, max, unit = "" }: Props) {
  const ceiling = Math.max(1, max ?? Math.max(...items.map((i) => i.value), 0));
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const pct = ceiling === 0 ? 0 : (item.value / ceiling) * 100;
        return (
          <li key={item.label} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs text-gray-700">
                {item.label}
              </span>
              <span className="font-mono text-xs tabular-nums text-gray-900">
                {item.value}
                {unit}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
              role="presentation"
            >
              <div
                className={`h-full rounded-full ${item.color ?? "bg-gray-900"} transition-[width] duration-500`}
                style={{ width: `${pct}%` }}
                aria-label={`${item.label}: ${item.value}${unit}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
