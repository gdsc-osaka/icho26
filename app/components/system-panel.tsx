import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** 角ブラケット（Stitch 流のコーナーマーカー）を表示 */
  bracket?: boolean;
};

export function SystemPanel({
  children,
  className = "",
  bracket = true,
}: Props) {
  return (
    <div
      className={`relative bg-[#05070A]/60 backdrop-blur-md border border-cyan-900/50 p-5 ${className}`}
    >
      {bracket && (
        <>
          <span className="pointer-events-none absolute -top-px -left-px h-2 w-2 border-t border-l border-cyan-400" />
          <span className="pointer-events-none absolute -top-px -right-px h-2 w-2 border-t border-r border-cyan-400" />
          <span className="pointer-events-none absolute -bottom-px -left-px h-2 w-2 border-b border-l border-cyan-400" />
          <span className="pointer-events-none absolute -bottom-px -right-px h-2 w-2 border-b border-r border-cyan-400" />
        </>
      )}
      {children}
    </div>
  );
}
