"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "glass" | "flat" | "outline";
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const variantClasses = {
  elevated: clsx(
    "bg-white border border-neutral-200/60 shadow-card",
    "dark:bg-neutral-900 dark:border-neutral-800 dark:shadow-card"
  ),
  glass: clsx(
    "glass glass-border shadow-card"
  ),
  flat: clsx(
    "bg-neutral-50 border border-neutral-100",
    "dark:bg-neutral-900/50 dark:border-neutral-800"
  ),
  outline: clsx(
    "bg-transparent border border-neutral-200",
    "dark:border-neutral-700"
  ),
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "elevated", padding = "md", interactive, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "rounded-xl",
          variantClasses[variant],
          paddingClasses[padding],
          interactive && "transition-all duration-fast hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={clsx("mb-3", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={clsx(
        "text-headline font-semibold text-neutral-900 dark:text-neutral-100",
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={clsx("text-subhead text-neutral-500 dark:text-neutral-400", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={clsx("", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        "mt-4 flex items-center gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800",
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
