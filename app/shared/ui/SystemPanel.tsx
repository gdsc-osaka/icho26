import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface SystemPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function SystemPanel({ children, className, ...rest }: SystemPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[color:var(--color-border-subtle)]",
        "bg-[color:var(--color-bg-surface)] p-6 shadow-[0_0_24px_rgba(0,240,255,0.08)]",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
