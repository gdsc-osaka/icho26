import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function ErrorAlert({ children }: Props) {
  return (
    <div
      role="alert"
      className="bg-danger/10 border border-danger text-danger px-4 py-2 rounded"
    >
      {children}
    </div>
  );
}
