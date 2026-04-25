import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface ErrorAlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
}

export function ErrorAlert({
  children,
  title = "ERROR",
  className,
  ...rest
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded border border-[color:var(--color-danger)]",
        "bg-[color:var(--color-danger-dim)] p-4 font-mono text-sm",
        "text-[color:var(--color-danger)]",
        className
      )}
      {...rest}
    >
      <div className="text-xs uppercase tracking-[0.2em]">{title}</div>
      <div className="mt-1 text-[color:var(--color-text-primary)]">{children}</div>
    </div>
  );
}
