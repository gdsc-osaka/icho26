import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function MonospaceLog({ children }: Props) {
  return (
    <pre className="font-mono text-sm text-text-secondary bg-bg-primary border border-accent-dim p-3 rounded whitespace-pre-wrap">
      {children}
    </pre>
  );
}
