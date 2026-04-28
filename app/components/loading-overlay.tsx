import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export function LoadingOverlay({ children = "LOADING..." }: Props) {
  return (
    <div className="fixed inset-0 bg-bg-primary/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="text-accent font-mono animate-pulse">{children}</div>
    </div>
  );
}
