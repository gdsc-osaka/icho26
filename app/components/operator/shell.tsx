import type { ReactNode } from "react";
import { OperatorMobileTabs, OperatorSidebar } from "./sidebar";

type Props = {
  title: string;
  /** Optional breadcrumb / context above the title. */
  eyebrow?: string;
  /** Optional right-aligned actions area in the page header. */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Light admin shell: left sidebar + main content with sticky page header.
 * Wraps every operator route except login.
 */
export function OperatorShell({ title, eyebrow, actions, children }: Props) {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <OperatorSidebar />
      <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur md:px-8">
          <div>
            {eyebrow && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                {eyebrow}
              </p>
            )}
            <h1 className="text-base font-semibold tracking-tight text-gray-900">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      <OperatorMobileTabs />
    </div>
  );
}
