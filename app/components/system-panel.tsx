import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function SystemPanel({ children, className = "" }: Props) {
  return (
    <div
      className={`bg-bg-surface border border-accent-dim rounded-lg p-6 ${className}`}
    >
      {children}
    </div>
  );
}
