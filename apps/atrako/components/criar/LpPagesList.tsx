"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ExternalLink,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { UrlChip } from "@/components/criar/CopyLinkButton";

export type LpPageItem = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  status: string;
  visits?: number;
  conversions?: number;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function PageThumb() {
  return (
    <div className="lp-page-thumb" aria-hidden>
      <LayoutTemplate className="lp-page-thumb-icon" strokeWidth={1.5} />
    </div>
  );
}

type Props = {
  pages: LpPageItem[];
  onAdd: () => void;
  editHref?: (page: LpPageItem) => string;
  emptyTitle?: string;
  emptyBody?: string;
  /** Slot à direita do título (ex.: BackLink). */
  leadingAction?: React.ReactNode;
};

/** Lista de páginas — estilo GreatPages, botões com raio curto. */
export function LpPagesList({
  pages,
  onAdd,
  editHref = (p) => `/criar/paginas/${encodeURIComponent(p.id)}`,
  emptyTitle = "Nenhuma página ainda",
  emptyBody = "Crie uma landing page com formulário ou checkout. O link público fica pronto na hora.",
  leadingAction,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  }, [pages, query]);

  return (
    <section className="lp-pages">
      <header className="lp-pages-head">
        <div className="min-w-0">
          <h2 className="lp-pages-title">Minhas páginas ({pages.length})</h2>
          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
            Tenha controle total sobre páginas, experiências e conversões.
          </p>
        </div>
        <div className="lp-pages-head-actions">
          {leadingAction}
          <button type="button" onClick={onAdd} className="lp-pages-btn-primary">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Adicionar página
          </button>
        </div>
      </header>

      <div className="lp-pages-toolbar">
        <SearchInput
          size="toolbar"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Encontrar páginas"
          aria-label="Encontrar páginas"
          className="lp-pages-search"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="lp-pages-empty">
          <div className="px-4 py-12 text-center">
            <p className="type-body-strong text-[var(--ink)]">
              {pages.length === 0 ? emptyTitle : "Nenhum resultado"}
            </p>
            <p className="mx-auto mt-1 max-w-sm type-caption text-[var(--ink-muted-48)]">
              {pages.length === 0 ? emptyBody : "Tente outro termo de busca."}
            </p>
          </div>
          {pages.length === 0 ? (
            <div className="flex justify-center pb-8">
              <button
                type="button"
                onClick={onAdd}
                className="lp-pages-btn-primary"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Adicionar página
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="lp-pages-list">
          {filtered.map((p) => (
            <li key={p.id} className="lp-page-row">
              <Link href={editHref(p)} className="lp-page-thumb-link" aria-label={p.name}>
                <PageThumb />
              </Link>

              <div className="lp-page-row-main">
                <Link
                  href={editHref(p)}
                  className="lp-page-name type-caption-strong text-[var(--ink)] truncate"
                >
                  {p.name}
                </Link>
                <UrlChip path={`/p/${p.slug}`} className="lp-page-url" />
              </div>

              <div className="lp-page-row-aside">
                <div className="lp-page-row-metrics">
                  <div className="lp-page-metric">
                    <span className="lp-page-metric-value tabular-nums">
                      {p.visits ?? 0}
                    </span>
                    <span className="lp-page-metric-label">Visitas</span>
                  </div>
                  <div className="lp-page-metric">
                    <span className="lp-page-metric-value tabular-nums">
                      {p.conversions ?? 0}
                    </span>
                    <span className="lp-page-metric-label">Conversões</span>
                  </div>
                  {p.priceCents > 0 ? (
                    <div className="lp-page-metric">
                      <span className="lp-page-metric-value tabular-nums">
                        {brl(p.priceCents)}
                      </span>
                      <span className="lp-page-metric-label">Preço</span>
                    </div>
                  ) : null}
                </div>

                <div className="lp-page-row-actions">
                  <Link href={editHref(p)} className="lp-pages-btn-secondary">
                    Editar design
                  </Link>
                  <a
                    href={`/p/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="lp-pages-icon-btn"
                    aria-label="Abrir página"
                    title="Abrir página"
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                  <Link
                    href={`/criar/paginas/${encodeURIComponent(p.id)}`}
                    className="lp-pages-icon-btn"
                    aria-label="Relatório"
                    title="Relatório"
                  >
                    <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                  <button
                    type="button"
                    className="lp-pages-icon-btn"
                    aria-label="Mais opções"
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
