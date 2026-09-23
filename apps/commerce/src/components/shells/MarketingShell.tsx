import { Logo } from "@/components/brand/Logo";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import { ReactNode } from "react";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <DarkGradientBg showLights={false} className="flex flex-col">
      <div data-theme="marketing" className="flex min-h-screen flex-col text-[var(--ink)]">
        <header className="shrink-0 border-b border-[var(--border)] bg-black/50 backdrop-blur-md">
          <div className="container flex h-14 items-center justify-between">
            <Logo />
            <nav className="cluster text-[var(--text-sm)] font-medium">
              <a href="/termos" className="no-underline text-[var(--muted)] hover:text-[var(--ink)]">
                Termos
              </a>
              <a
                href="/privacidade"
                className="no-underline text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Privacidade
              </a>
              <a href="/login" className="no-underline text-[var(--muted)] hover:text-[var(--ink)]">
                Entrar
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1 w-full animate-enter">{children}</main>

        <footer className="shrink-0 mt-auto border-t border-[var(--border)] bg-black/60 backdrop-blur-md">
          <div className="container py-8 md:py-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="stack-sm max-w-xs">
                <Logo />
                <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">
                  Venda de produtos digitais com checkout transparente e área de membros.
                </p>
              </div>
              <div className="cluster gap-x-6 gap-y-2 text-[var(--text-sm)]">
                <a href="/termos" className="no-underline text-[var(--muted)] hover:text-[var(--ink)]">
                  Termos de uso
                </a>
                <a
                  href="/privacidade"
                  className="no-underline text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  Privacidade
                </a>
                <a href="/login" className="no-underline text-[var(--muted)] hover:text-[var(--ink)]">
                  Área do cliente
                </a>
              </div>
            </div>
            <div className="mt-8 pt-5 border-t border-[var(--border)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="m-0 text-[var(--text-xs)] text-[var(--muted)]">
                © {new Date().getFullYear()} Signal Commerce. Todos os direitos reservados.
              </p>
              <p className="m-0 font-mono text-[var(--text-xs)] text-[var(--muted)]">
                Pagamentos via Mercado Pago
              </p>
            </div>
          </div>
        </footer>
      </div>
    </DarkGradientBg>
  );
}
