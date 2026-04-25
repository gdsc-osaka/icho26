import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface MonospaceLogProps extends HTMLAttributes<HTMLPreElement> {
  children: ReactNode;
}

export function MonospaceLog({ children, className, ...rest }: MonospaceLogProps) {
  return (
    <pre
      className={cn(
        "whitespace-pre-wrap break-words rounded border",
        "border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface-raised)]",
        "p-4 font-mono text-xs leading-relaxed text-[color:var(--color-text-secondary)]",
        className
      )}
      {...rest}
    >
      {children}
    </pre>
  );
}
