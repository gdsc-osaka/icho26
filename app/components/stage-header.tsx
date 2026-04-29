import type { ReactNode } from "react";

type Props = {
  /** 表示用タイトル（大文字推奨） */
  title: string;
  /** 上部に出すラベル。例: "STAGE 01" */
  eyebrow?: string;
  children?: ReactNode;
};

export function StageHeader({ title, eyebrow, children }: Props) {
  return (
    <header className="space-y-3 text-center">
      {eyebrow && (
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-cyan-500/60">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl font-bold tracking-tight text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.4)] md:text-4xl">
        {title}
      </h1>
      <div className="mx-auto h-px w-24 bg-cyan-500/50" />
      {children && (
        <div className="pt-2 text-sm leading-relaxed text-on-surface-variant">
          {children}
        </div>
      )}
    </header>
  );
}
