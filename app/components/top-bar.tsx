import { Icon } from "./icon";

type Props = {
  /** 右肩に表示する識別ID。例: ID: X-99 */
  sessionId?: string;
  /** 右肩アイコン名。指定時は sessionId を上書き */
  rightIcon?: string;
};

export function TopBar({ sessionId, rightIcon }: Props) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-cyan-500/30 bg-[#05070A]/80 px-4 shadow-[0_4px_20px_rgba(0,240,255,0.1)] backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-400/50 bg-cyan-500/20">
          <Icon name="lens_blur" className="text-xs text-cyan-400" />
        </div>
        <h1 className="font-display text-[11px] font-bold uppercase tracking-widest text-cyan-400 text-glow-cyan">
          IRIS_OS_v2.4
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {sessionId && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
            {sessionId}
          </span>
        )}
        {rightIcon && <Icon name={rightIcon} className="text-cyan-400" />}
      </div>
    </header>
  );
}
