import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className = "", ...rest }: Props) {
  return (
    <input
      type="text"
      {...rest}
      className={`bg-bg-primary border border-text-secondary rounded px-3 py-2 text-text-primary font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
    />
  );
}
