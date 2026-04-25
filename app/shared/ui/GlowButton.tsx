import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "lg";
}

const VARIANT_CLASS: Record<NonNullable<GlowButtonProps["variant"]>, string> = {
  primary:
    "border-[color:var(--color-accent)] bg-[color:var(--color-accent-dim)] text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)] hover:text-[color:var(--color-bg-primary)] shadow-[0_0_16px_rgba(0,240,255,0.4)]",
  secondary:
    "border-[color:var(--color-border-strong)] bg-transparent text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-accent-dim)]",
  danger:
    "border-[color:var(--color-danger)] bg-[color:var(--color-danger-dim)] text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)] hover:text-[color:var(--color-bg-primary)]",
};

const SIZE_CLASS: Record<NonNullable<GlowButtonProps["size"]>, string> = {
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export function GlowButton({
  children,
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...rest
}: GlowButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex w-full items-center justify-center rounded border font-mono uppercase tracking-[0.15em]",
        "transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
