type Slice = {
  label: string;
  value: number;
  /** SVG color (hex / CSS). */
  color: string;
};

type Props = {
  slices: Slice[];
  size?: number;
  centerLabel?: string;
  centerValue?: string | number;
};

/**
 * SVG-based donut chart. Computes stroke-dasharray segments around a single circle.
 */
export function DonutChart({
  slices,
  size = 160,
  centerLabel,
  centerValue,
}: Props) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  const arcs = slices.reduce<
    { label: string; color: string; length: number; offset: number }[]
  >((acc, s) => {
    const cumulative = acc.reduce((sum, a) => sum + a.length, 0);
    const length = total === 0 ? 0 : (s.value / total) * circumference;
    const offset = circumference - cumulative;
    acc.push({ label: s.label, color: s.color, length, offset });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={12}
        />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={a.color}
            strokeWidth={12}
            strokeDasharray={`${a.length} ${circumference - a.length}`}
            strokeDashoffset={a.offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dasharray 500ms" }}
          />
        ))}
        {centerValue !== undefined && (
          <text
            x={size / 2}
            y={size / 2}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-gray-900 font-mono text-2xl font-semibold"
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x={size / 2}
            y={size / 2 + 22}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-gray-500 font-mono text-[10px] uppercase tracking-widest"
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            <span className="font-mono text-xs text-gray-700">{s.label}</span>
            <span className="font-mono text-xs tabular-nums text-gray-900">
              {s.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
