import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Raio curto (~5px) — CTAs do app; pill fica em search / chips / pill-select. */
const btnRadius = "rounded-[var(--radius-xs)]";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: `${btnRadius} bg-[var(--primary)] px-[22px] py-[11px] type-body text-[var(--on-primary)]`,
        "secondary-pill": `${btnRadius} border border-[var(--primary)] bg-[var(--canvas)] px-[22px] py-[11px] type-body text-[var(--primary)]`,
        "dark-utility": `${btnRadius} bg-[var(--ink)] px-[15px] py-2 type-button-utility text-[var(--on-dark)]`,
        pearl: `${btnRadius} border-[3px] border-[var(--divider-soft)] bg-[var(--surface-pearl)] px-[14px] py-2 type-caption text-[var(--ink-muted-80)]`,
        "store-hero": `${btnRadius} bg-[var(--primary)] px-7 py-[14px] type-button-large text-[var(--on-primary)]`,
        ghost: `${btnRadius} bg-transparent px-3 py-2 type-button-utility text-[var(--primary)]`,
        outline: `${btnRadius} border border-[var(--hairline)] bg-[var(--canvas)] px-[22px] py-[11px] type-body text-[var(--ink)]`,
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "variant"> {
  variant?:
    | NonNullable<VariantProps<typeof buttonVariants>["variant"]>
    | "default"
    | "outline"
    | "ghost";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    const resolved = (
      variant === "default" ? "primary" : variant
    ) as NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
    return (
      <button
        className={cn(buttonVariants({ variant: resolved }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
