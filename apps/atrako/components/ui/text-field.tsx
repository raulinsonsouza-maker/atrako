"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: React.ReactNode;
  hint?: React.ReactNode;
}

/**
 * Campo de formulário canônico (YAML: text-field).
 * Sempre este componente — nunca input estilizado na page.
 */
const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, className, type = "text", id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const isPassword = type === "password";
    const [revealed, setRevealed] = React.useState(false);

    return (
      <div className={cn("block", className)}>
        <label htmlFor={inputId} className="type-caption-strong text-[var(--ink)]">
          {label}
        </label>
        <div className="relative mt-2">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && revealed ? "text" : type}
            className={cn(
              "h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)] disabled:opacity-50",
              isPassword && "pr-12",
            )}
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[var(--ink-muted-48)] active:scale-95"
              aria-label={revealed ? "Ocultar" : "Mostrar"}
            >
              {revealed ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          ) : null}
        </div>
        {hint ? (
          <p className="mt-1.5 type-fine-print text-[var(--ink-muted-48)]">{hint}</p>
        ) : null}
      </div>
    );
  },
);
TextField.displayName = "TextField";

export { TextField };
