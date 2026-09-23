import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  onDark?: boolean;
}

const TextLink = React.forwardRef<HTMLAnchorElement, TextLinkProps>(
  ({ className, onDark = false, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        "type-body underline-offset-2 hover:underline",
        onDark ? "text-[var(--primary-on-dark)]" : "text-[var(--primary)]",
        className
      )}
      {...props}
    />
  )
);
TextLink.displayName = "TextLink";

export { TextLink };
