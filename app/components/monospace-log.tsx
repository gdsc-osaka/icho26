import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function MonospaceLog({ children }: Props) {
  return (
    <pre className="whitespace-pre-wrap border border-cyan-900/50 bg-[#05070A]/80 p-3 font-mono text-sm tracking-wider text-on-surface">
      {children}
    </pre>
  );
}
