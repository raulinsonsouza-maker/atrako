"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "tertiary" | "accent" | "ghost" | "outline" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: clsx(
    "bg-gradient-to-b from-primary-400 to-primary-500 text-white",
    "shadow-sm hover:from-primary-500 hover:to-primary-600",
    "dark:from-primary-500 dark:to-primary-600 dark:hover:from-primary-400 dark:hover:to-primary-500"
  ),
  secondary: clsx(
    "bg-white/80 text-neutral-900 border border-neutral-200/80",
    "backdrop-blur-sm hover:bg-neutral-100/80",
    "dark:bg-neutral-800/80 dark:text-neutral-100 dark:border-neutral-700/80 dark:hover:bg-neutral-700/80"
  ),
  tertiary: clsx(
    "bg-transparent text-primary-500 hover:bg-primary-50",
    "dark:text-primary-400 dark:hover:bg-primary-900/20"
  ),
  accent: clsx(
    "bg-gradient-to-b from-accent-400 to-accent-500 text-white",
    "shadow-sm hover:from-accent-500 hover:to-accent-600",
    "dark:from-accent-500 dark:to-accent-600 dark:hover:from-accent-400 dark:hover:to-accent-500"
  ),
  ghost: clsx(
    "bg-transparent text-neutral-700 hover:bg-neutral-100",
    "dark:text-neutral-300 dark:hover:bg-neutral-800"
  ),
  outline: clsx(
    "bg-transparent text-neutral-900 border border-neutral-300 hover:bg-neutral-50",
    "dark:text-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800"
  ),
  danger: clsx(
    "bg-gradient-to-b from-error-400 to-error-500 text-white",
    "shadow-sm hover:from-error-500 hover:to-error-600"
  ),
  success: clsx(
    "bg-gradient-to-b from-success-400 to-success-500 text-white",
    "shadow-sm hover:from-success-500 hover:to-success-600"
  ),
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-3 text-xs gap-1.5 rounded-md",
  md: "h-8 px-4 text-sm gap-2 rounded-md",
  lg: "h-10 px-5 text-base gap-2 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth,
      isLoading,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          "inline-flex items-center justify-center font-medium",
          "transition-all duration-fast ease-apple",
          "active:scale-[0.98] motion-reduce:transform-none",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
