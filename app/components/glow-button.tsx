import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export function GlowButton({ children, className = "", ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`bg-accent text-bg-primary font-display font-semibold px-6 py-3 rounded-md shadow-[0_0_16px_var(--color-accent-dim)] hover:shadow-[0_0_24px_var(--color-accent)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
