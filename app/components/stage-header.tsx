import type { ReactNode } from "react";

type Props = {
  title: string;
  children?: ReactNode;
};

export function StageHeader({ title, children }: Props) {
  return (
    <header className="space-y-3 pb-4 border-b border-accent-dim">
      <h1 className="font-display text-2xl font-semibold text-accent">
        {title}
      </h1>
      {children && (
        <div className="text-text-secondary text-sm leading-relaxed">
          {children}
        </div>
      )}
    </header>
  );
}
