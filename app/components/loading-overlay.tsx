import type { ReactNode } from "react";

type Props = {
  children?: ReactNode;
};

export function LoadingOverlay({ children = "LOADING..." }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070A]/80 backdrop-blur-sm">
      <div className="font-mono uppercase tracking-widest text-cyan-400 animate-pulse">
        {children}
      </div>
    </div>
  );
}
