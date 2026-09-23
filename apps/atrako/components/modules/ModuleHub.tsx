import Link from "next/link";
import type { ReactNode } from "react";
import {
  ATRAKO_MODULES,
  statusLabel,
  type AtrakoModule,
} from "@/lib/atrako/modules-catalog";

function StatusPill({ status }: { status: AtrakoModule["status"] }) {
  const tone =
    status === "live"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : status === "absorbing"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 type-micro-legal ring-1 ring-inset ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}

export function ModuleHub(props: {
  moduleId: string;
  children?: ReactNode;
}) {
  const module = ATRAKO_MODULES.find((item) => item.id === props.moduleId);
  if (!module) {
    return <p className="type-caption text-[var(--muted-foreground)]">Módulo não encontrado.</p>;
  }

  return (
    <main className="atrako-fade-up mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="type-fine-print uppercase tracking-[0.22em] text-[var(--primary-strong)]">
            Módulo Atrako
          </p>
          <StatusPill status={module.status} />
        </div>
        <h1 className="type-tagline text-[var(--foreground)]">
          {module.name}
        </h1>
        <p className="max-w-2xl type-body text-[var(--muted-foreground)]">
          {module.tagline}
        </p>
        <Link
          href={module.path}
          className="inline-flex type-caption text-[var(--primary-strong)] underline"
        >
          Abrir {module.name}
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="type-fine-print uppercase tracking-wide text-[var(--muted-foreground)]">
          No shell
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {module.liveInShell.map((link) => (
            <li key={link.href + link.label}>
              <Link
                href={link.href}
                className="atrako-surface block rounded-[var(--radius)] p-4 transition hover:opacity-90"
              >
                <p className="type-body-strong text-[var(--foreground)]">{link.label}</p>
                <p className="mt-1 type-caption text-[var(--muted-foreground)]">{link.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {props.children}
    </main>
  );
}
