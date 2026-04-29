import type { CSSProperties } from "react";

type Props = {
  name: string;
  className?: string;
  filled?: boolean;
  style?: CSSProperties;
};

export function Icon({ name, className = "", filled = false, style }: Props) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={
        filled
          ? { fontVariationSettings: "'FILL' 1", ...style }
          : style
      }
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
