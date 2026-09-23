import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";

type TileTone = "light" | "parchment" | "dark" | "dark-2" | "dark-3";

export interface ProductTileProps extends React.HTMLAttributes<HTMLElement> {
  tone?: TileTone;
  title: string;
  tagline?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  image?: React.ReactNode;
}

const toneClass: Record<TileTone, string> = {
  light: "product-tile product-tile-light",
  parchment: "product-tile product-tile-parchment",
  dark: "product-tile product-tile-dark",
  "dark-2": "product-tile product-tile-dark-2",
  "dark-3": "product-tile product-tile-dark-3",
};

export function ProductTile({
  tone = "light",
  title,
  tagline,
  primaryHref,
  primaryLabel = "Saiba mais",
  secondaryHref,
  secondaryLabel = "Comprar",
  image,
  className,
  children,
  ...props
}: ProductTileProps) {
  const onDark = tone.startsWith("dark");

  return (
    <section className={cn(toneClass[tone], className)} {...props}>
      <div className="mx-auto flex max-w-[980px] flex-col items-center gap-3">
        <h2 className={cn("type-display-lg", onDark ? "text-[var(--on-dark)]" : "text-[var(--ink)]")}>
          {title}
        </h2>
        {tagline ? (
          <p className={cn("type-lead", onDark ? "text-[var(--body-muted)]" : "text-[var(--ink)]")}>
            {tagline}
          </p>
        ) : null}
        {(primaryHref || secondaryHref) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            {primaryHref ? (
              <a href={primaryHref}>
                <Button variant="primary">{primaryLabel}</Button>
              </a>
            ) : null}
            {secondaryHref ? (
              onDark ? (
                <TextLink href={secondaryHref} onDark>
                  {secondaryLabel}
                </TextLink>
              ) : (
                <a href={secondaryHref}>
                  <Button variant="secondary-pill">{secondaryLabel}</Button>
                </a>
              )
            ) : null}
          </div>
        )}
        {image ? <div className="mt-8 shadow-product">{image}</div> : null}
        {children}
      </div>
    </section>
  );
}
