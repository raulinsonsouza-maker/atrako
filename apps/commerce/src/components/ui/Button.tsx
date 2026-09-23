import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] !text-[var(--accent-ink)] hover:bg-[var(--color-accent-deep)] shadow-[var(--shadow-sm)]",
  secondary:
    "bg-white/5 !text-[var(--ink)] border border-[var(--border)] hover:bg-white/10",
  outline:
    "bg-transparent !text-[var(--ink)] border border-[var(--border)] hover:bg-white/10",
  ghost: "bg-transparent !text-[var(--muted)] hover:!text-[var(--ink)] hover:bg-[var(--bg-muted)]",
  danger: "bg-[var(--danger)] !text-white hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[var(--text-xs)] rounded-[var(--radius-sm)]",
  md: "h-10 px-4 text-[var(--text-sm)] rounded-[var(--radius-full)]",
  lg: "h-11 px-5 text-[var(--text-sm)] rounded-[var(--radius-full)]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] transition duration-[var(--dur-fast)] disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
