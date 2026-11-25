import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type SubNavLink = { href: string; label: string };

export interface SubNavFrostedProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  /** Se definido, substitui o texto do título. */
  logoUrl?: string | null;
  links?: SubNavLink[];
  ctaHref?: string;
  ctaLabel?: string;
}

export function SubNavFrosted({
  title,
  logoUrl,
  links = [],
  ctaHref,
  ctaLabel = "Comprar",
  className,
  ...props
}: SubNavFrostedProps) {
  return (
    <nav
      className={cn(
        "frosted-bar sticky top-0 z-30 flex h-[52px] items-center justify-between gap-4 border-b border-[rgba(0,0,0,0.08)] px-4 md:px-8",
        className
      )}
      {...props}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={title} className="h-8 w-auto max-w-[180px] object-contain object-left" />
      ) : (
        <p className="type-tagline truncate text-[var(--ink)]">{title}</p>
      )}
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-4 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="type-button-utility text-[var(--ink)] hover:text-[var(--primary)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
        {ctaHref ? (
          <Link href={ctaHref}>
            <Button variant="primary" className="!px-4 !py-2 type-button-utility">
              {ctaLabel}
            </Button>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
