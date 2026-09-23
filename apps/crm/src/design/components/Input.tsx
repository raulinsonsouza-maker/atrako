"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  hint?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-7 px-2.5 text-xs rounded-sm",
  md: "h-8 px-3 text-sm rounded-sm",
  lg: "h-10 px-4 text-base rounded-md",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, size = "md", className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? `input-${generatedId.replace(/:/g, "")}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-footnote font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "block w-full border bg-white text-neutral-900",
            "placeholder:text-neutral-400",
            "transition-all duration-fast ease-apple",
            "focus:outline-none focus:ring-[3px] focus:ring-primary-500/20",
            "disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500",
            "dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder-neutral-500",
            "dark:disabled:bg-neutral-900 dark:disabled:text-neutral-600",
            error
              ? "border-error-500 focus:border-error-500"
              : clsx(
                  "border-neutral-300 hover:border-neutral-400",
                  "focus:border-primary-500",
                  "dark:border-neutral-600 dark:hover:border-neutral-500 dark:focus:border-primary-500"
                ),
            sizeClasses[size],
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-caption-1 text-error-500"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="mt-1.5 text-caption-1 text-neutral-500 dark:text-neutral-400"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
