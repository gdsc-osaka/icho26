import type { ReactNode } from "react";
import { cn } from "./cn";

export interface StageHeaderProps {
  stage: string;
  title: string;
  children?: ReactNode;
  className?: string;
}

export function StageHeader({ stage, title, children, className }: StageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      <span className="font-mono text-xs uppercase tracking-[0.3em] text-[color:var(--color-accent)]">
        [ {stage} ]
      </span>
      <h1 className="text-2xl font-semibold tracking-wide text-[color:var(--color-text-primary)]">
        {title}
      </h1>
      {children && (
        <div className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          {children}
        </div>
      )}
    </header>
  );
}
