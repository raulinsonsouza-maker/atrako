import Link from "next/link";
import type { ReactNode } from "react";

const LEGAL_NAV = [
  { href: "/politica-de-privacidade", label: "Privacidade" },
  { href: "/termos-de-uso", label: "Termos" },
  { href: "/exclusao-de-dados", label: "Exclusão de dados" },
] as const;

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--canvas-parchment)] text-[var(--ink)]">
      <header className="border-b border-[var(--hairline)] px-6 py-5">
        <div className="mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-4">
          <Link href="/" className="type-tagline text-[var(--ink)]">
            Atrako
          </Link>
          <nav className="flex flex-wrap gap-4 type-fine-print text-[var(--ink-muted-48)]">
            {LEGAL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-[var(--primary)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-6 py-12 sm:py-16">
        <p className="type-fine-print uppercase tracking-[0.14em] text-[var(--ink-muted-48)]">
          Legal
        </p>
        <h1 className="type-tagline mt-3 text-[var(--ink)]">{title}</h1>
        <p className="type-fine-print mt-2 text-[var(--ink-muted-48)]">
          Última atualização: {updatedAt}
        </p>
        <div className="legal-prose mt-10 space-y-6 type-body text-[var(--ink)] [&_h2]:type-caption-strong [&_h2]:mt-10 [&_h2]:text-[var(--ink)] [&_p]:text-[var(--ink-muted-80)] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-[var(--ink-muted-80)] [&_a]:text-[var(--primary)]">
          {children}
        </div>
      </main>

      <footer className="border-t border-[var(--hairline)] px-6 py-8">
        <p className="mx-auto max-w-[720px] type-fine-print text-[var(--ink-muted-48)]">
          © {new Date().getFullYear()} Atrako ·{" "}
          <a href="mailto:privacidade@atrako.com.br">privacidade@atrako.com.br</a>
        </p>
      </footer>
    </div>
  );
}
