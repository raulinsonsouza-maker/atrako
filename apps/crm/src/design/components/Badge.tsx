"use client";

import { type HTMLAttributes } from "react";
import { clsx } from "clsx";

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline" | "purple" | "pink" | "teal";
type BadgeSize = "sm" | "md";

const variantClasses: Record<BadgeVariant, string> = {
  default: clsx(
    "bg-neutral-100 text-neutral-600",
    "dark:bg-neutral-800 dark:text-neutral-400"
  ),
  primary: clsx(
    "bg-primary-100 text-primary-600",
    "dark:bg-primary-900/30 dark:text-primary-400"
  ),
  success: clsx(
    "bg-success-50 text-success-600",
    "dark:bg-success-900/30 dark:text-success-400"
  ),
  warning: clsx(
    "bg-warning-50 text-warning-700",
    "dark:bg-warning-900/30 dark:text-warning-400"
  ),
  error: clsx(
    "bg-error-50 text-error-600",
    "dark:bg-error-900/30 dark:text-error-400"
  ),
  outline: clsx(
    "bg-transparent text-neutral-700 border border-neutral-300",
    "dark:text-neutral-300 dark:border-neutral-600"
  ),
  purple: clsx(
    "bg-tint-purple/10 text-tint-purple",
    "dark:bg-tint-purple/20"
  ),
  pink: clsx(
    "bg-tint-pink/10 text-tint-pink",
    "dark:bg-tint-pink/20"
  ),
  teal: clsx(
    "bg-tint-teal/10 text-tint-teal",
    "dark:bg-tint-teal/20"
  ),
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "h-5 px-2 text-[11px]",
  md: "h-6 px-2.5 text-xs",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

export function Badge({ variant = "default", size = "sm", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-medium rounded-full",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={clsx(
            "h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-success-500",
            variant === "warning" && "bg-warning-500",
            variant === "error" && "bg-error-500",
            variant === "primary" && "bg-primary-500",
            variant === "default" && "bg-neutral-400",
            variant === "outline" && "bg-neutral-400",
            variant === "purple" && "bg-tint-purple",
            variant === "pink" && "bg-tint-pink",
            variant === "teal" && "bg-tint-teal"
          )}
        />
      )}
      {children}
    </span>
  );
}
