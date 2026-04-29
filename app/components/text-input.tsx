import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className = "", ...rest }: Props) {
  return (
    <input
      type="text"
      {...rest}
      className={`w-full bg-[#05070A]/80 border border-cyan-900/60 px-4 py-3 font-mono text-base tracking-wider text-on-surface placeholder:text-cyan-900 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 ${className}`}
    />
  );
}
