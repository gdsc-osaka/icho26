import type { ReactNode } from "react";
import { Icon } from "./icon";

type Props = {
  children: ReactNode;
};

export function ErrorAlert({ children }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border border-error/60 bg-error/10 px-3 py-2 font-mono text-sm text-error"
    >
      <Icon name="error" className="text-base text-error" />
      <span>{children}</span>
    </div>
  );
}
