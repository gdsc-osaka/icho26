import type { ReactNode } from "react";
import { cn } from "./cn";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}

export function AppShell({ children, className, wide }: AppShellProps) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-screen flex-col gap-6 px-4 py-8",
        wide ? "max-w-5xl" : "max-w-md",
        className
      )}
    >
      {children}
    </main>
  );
}
