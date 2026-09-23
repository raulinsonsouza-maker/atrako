import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-[var(--foreground)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:pointer-events-none disabled:opacity-50",
          variant === "default" &&
            "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
          variant === "outline" &&
            "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--card)]",
          variant === "ghost" && "text-[var(--foreground)] hover:bg-[var(--muted)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
