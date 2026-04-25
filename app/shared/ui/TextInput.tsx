import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "./cn";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    { label, hint, error, className, id, ...rest },
    ref
  ) {
    const inputId =
      id ??
      `text-input-${
        typeof rest.name === "string" ? rest.name : Math.random().toString(36).slice(2)
      }`;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="font-mono text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          autoComplete="off"
          inputMode={rest.inputMode ?? "text"}
          className={cn(
            "w-full min-h-11 rounded border bg-[color:var(--color-bg-surface)]",
            "border-[color:var(--color-border-subtle)] px-4 py-2 font-mono text-base",
            "text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)]",
            "focus:border-[color:var(--color-accent)] focus:outline-none",
            "focus:shadow-[0_0_12px_rgba(0,240,255,0.3)]",
            error && "border-[color:var(--color-danger)]",
            className
          )}
          {...rest}
        />
        {hint && !error && (
          <p className="text-xs text-[color:var(--color-text-muted)]">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-[color:var(--color-danger)]">{error}</p>
        )}
      </div>
    );
  }
);
