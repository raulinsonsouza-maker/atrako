import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type FooterColumn = {
  title: string;
  links: Array<{ href: string; label: string }>;
};

export interface SiteFooterProps extends React.HTMLAttributes<HTMLElement> {
  columns?: FooterColumn[];
  legal?: string;
}

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Atrako",
    links: [
      { href: "/", label: "Agente" },
      { href: "/crm", label: "CRM" },
      { href: "/commerce", label: "Commerce" },
    ],
  },
  {
    title: "Conta",
    links: [
      { href: "/config", label: "Config" },
      { href: "/membros", label: "Membros" },
    ],
  },
];

export function SiteFooter({
  columns = DEFAULT_COLUMNS,
  legal = "© Atrako. Todos os direitos reservados.",
  className,
  ...props
}: SiteFooterProps) {
  return (
    <footer
      className={cn("bg-[var(--canvas-parchment)] px-6 py-16 text-[var(--ink-muted-80)]", className)}
      {...props}
    >
      <div className="mx-auto grid max-w-content gap-10 md:grid-cols-3">
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="type-caption-strong mb-3 text-[var(--ink)]">{col.title}</h3>
            <ul className="type-dense-link">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-[var(--primary)]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="type-fine-print mx-auto mt-12 max-w-content text-[var(--ink-muted-48)]">{legal}</p>
    </footer>
  );
}
