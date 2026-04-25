import { cn } from "./cn";

export interface LoadingOverlayProps {
  show: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({
  show,
  message = "PROCESSING...",
  className,
}: LoadingOverlayProps) {
  if (!show) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center",
        "bg-[color:var(--color-bg-primary)]/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--color-accent-dim)] border-t-[color:var(--color-accent)]" />
      <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent)]">
        {message}
      </p>
    </div>
  );
}
