import { useState } from "react";
import { Icon } from "../icon";

type Props = {
  value: string;
  /** Display label override; defaults to truncated value. */
  label?: string;
  className?: string;
};

/**
 * Small inline copy-to-clipboard button. Shows feedback for ~1.5s.
 */
export function CopyButton({ value, label, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={value}
      className={`group inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5 font-mono text-[10px] text-gray-600 hover:border-gray-300 hover:bg-gray-50 ${className}`}
    >
      <span className="max-w-[10rem] truncate">{label ?? value}</span>
      <Icon
        name={copied ? "check" : "content_copy"}
        className={`text-xs ${copied ? "text-emerald-600" : "text-gray-400 group-hover:text-gray-600"}`}
      />
    </button>
  );
}
