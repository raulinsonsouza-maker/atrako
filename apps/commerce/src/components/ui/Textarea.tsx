import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full min-h-24 rounded-[var(--radius-sm)] border border-[var(--border)] bg-black/40 px-3 py-2 text-[var(--text-sm)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[rgb(201_100_66_/_0.25)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
