import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const VARIANTS: Record<Variant, string> = {
  primary: "border-cyan-400 text-cyan-400 hover:bg-cyan-500/10 active:scale-95",
  ghost:
    "border-cyan-900/50 text-on-surface-variant hover:border-cyan-400 hover:text-cyan-400",
  danger: "border-error text-error hover:bg-error/10",
};

export function GlowButton({
  children,
  className = "",
  variant = "primary",
  ...rest
}: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`group relative border-2 ${VARIANTS[variant]} bg-transparent px-10 py-3 font-mono text-sm uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      <span className="pointer-events-none absolute -top-1 -left-1 h-2 w-2 bg-cyan-400 transition-transform group-hover:scale-150" />
      <span className="pointer-events-none absolute -bottom-1 -right-1 h-2 w-2 bg-cyan-400 transition-transform group-hover:scale-150" />
      {children}
    </button>
  );
}
