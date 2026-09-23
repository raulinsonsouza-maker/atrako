import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type BackLinkProps = {
  href?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  /** Aria quando o texto visual for só ícone (raro). */
  "aria-label"?: string;
};

/**
 * Link/botão de voltar canônico do App shell.
 * YAML: back-link — sempre ChevronLeft + rótulo.
 */
export function BackLink({
  href,
  onClick,
  children = "Voltar",
  className,
  "aria-label": ariaLabel,
}: BackLinkProps) {
  const classes = cn("back-link", className);
  const content = (
    <>
      <ChevronLeft className="back-link-icon" strokeWidth={1.75} aria-hidden />
      <span>{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes} aria-label={ariaLabel}>
      {content}
    </button>
  );
}
