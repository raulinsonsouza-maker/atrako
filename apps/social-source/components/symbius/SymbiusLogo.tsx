import Link from "next/link";
import { Zap } from "lucide-react";

export function SymbiusLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const text = size === "sm" ? "text-lg" : "text-xl";
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-display font-bold">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--symbius-primary)]">
        <Zap className="h-5 w-5 text-white" />
      </span>
      <span className={text}>
        Symbius <span className="symbius-gradient-text">Flow</span>
      </span>
    </Link>
  );
}

export function SymbiusMarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--symbius-border)] bg-[var(--symbius-bg)]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <SymbiusLogo />
        <nav className="flex items-center gap-3">
          <Link href="/pricing" className="hidden text-sm text-[var(--symbius-muted)] hover:text-white sm:block">
            Planos
          </Link>
          <Link href="/privacy" className="hidden text-sm text-[var(--symbius-muted)] hover:text-white md:block">
            Privacidade
          </Link>
          <Link href="/login" className="symbius-btn-outline px-4 py-2 text-sm">
            Entrar
          </Link>
          <Link href="/signup" className="symbius-btn-primary px-4 py-2 text-sm">
            Criar conta grátis
          </Link>
        </nav>
      </div>
    </header>
  );
}
