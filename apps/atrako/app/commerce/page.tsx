"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  BarChart3,
  ExternalLink,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { IconButton } from "@/components/ui/icon-button";
import { UrlChip } from "@/components/criar/CopyLinkButton";
import { cn } from "@/lib/utils";
import { isLpSalesPageV1, isLpSalesPageV2 } from "@/lib/criar/lp-schema";

type Tab = "produtos" | "pedidos" | "ofertas" | "cupons";

type Product = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  status: string;
  visits?: number;
  conversions?: number;
  salesPage?: unknown;
};

type Order = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  totalCents: number;
  createdAt: string;
};

type Offer = {
  id: string;
  type: string;
  discountPercent: number;
  triggerProduct: { name: string };
  offeredProduct: { name: string };
};

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: number;
  usedCount: number;
};

const OFFER_TYPE_LABELS: Record<string, string> = {
  ORDER_BUMP: "Oferta no checkout",
  POST_PURCHASE: "Pós-compra",
};

const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "Publicado",
  DRAFT: "Rascunho",
  ARCHIVED: "Arquivado",
  PAID: "Pago",
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function offerTypeLabel(type: string) {
  return OFFER_TYPE_LABELS[type] ?? type;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="type-body-strong text-[var(--ink)]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm type-caption text-[var(--ink-muted-48)]">
        {body}
      </p>
    </div>
  );
}

function PageThumb({ name }: { name: string }) {
  const letter = (name.trim()[0] || "P").toUpperCase();
  return (
    <div className="lp-page-thumb" aria-hidden>
      <LayoutTemplate className="lp-page-thumb-icon" strokeWidth={1.5} />
      <span className="lp-page-thumb-letter type-micro-legal">{letter}</span>
    </div>
  );
}

const addPageHref = "/criar/oferta?mode=manual";

export default function CommercePage() {
  const { data: clientes = [] } = useQuery({
    queryKey: ["commerce-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });
  const workspaceId = clientes[0]?.id as string | undefined;
  const [tab, setTab] = useState<Tab>("produtos");
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-data", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        products: Product[];
        orders: Order[];
        offers: Offer[];
        coupons: Coupon[];
        mpConnected?: boolean;
      }>;
    },
    enabled: Boolean(workspaceId),
  });

  const products = data?.products ?? [];
  const pages = useMemo(
    () =>
      products.filter(
        (p) => isLpSalesPageV2(p.salesPage) || isLpSalesPageV1(p.salesPage),
      ),
    [products],
  );
  const orders = data?.orders ?? [];
  const offers = data?.offers ?? [];
  const coupons = data?.coupons ?? [];

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q),
    );
  }, [pages, query]);

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "produtos", label: "Páginas", count: pages.length },
    { id: "pedidos", label: "Pedidos", count: orders.length },
    { id: "ofertas", label: "Upsells", count: offers.length },
    { id: "cupons", label: "Cupons", count: coupons.length },
  ];

  return (
    <AppPage
      title="Loja"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 type-fine-print ${
              data?.mpConnected
                ? "bg-[var(--success)]/10 text-[var(--success)]"
                : "bg-[var(--canvas)] text-[var(--ink-muted-48)]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                data?.mpConnected
                  ? "bg-[var(--success)]"
                  : "bg-[var(--ink-muted-48)]"
              }`}
            />
            {data?.mpConnected ? "Mercado Pago" : "Sem Mercado Pago"}
          </span>
          <Link
            href={addPageHref}
            className={cn(buttonVariants({ variant: "primary" }), "!gap-1.5")}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Adicionar página
          </Link>
        </div>
      }
    >
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        Controle páginas, pedidos e conversões da loja.
      </p>

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 type-button-utility transition active:scale-95 ${
              tab === t.id
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "text-[var(--ink-muted-80)] hover:bg-[var(--canvas-parchment)]"
            }`}
          >
            {t.label}
            <span
              className={`tabular-nums ${
                tab === t.id
                  ? "text-[var(--on-primary)]/80"
                  : "text-[var(--ink-muted-48)]"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : null}

      {tab === "produtos" && !isLoading ? (
        <section className="lp-pages mt-5">
          <header className="lp-pages-head">
            <div className="min-w-0">
              <h2 className="type-tagline text-[var(--ink)]">
                Minhas páginas ({pages.length})
              </h2>
              <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                Tenha controle total sobre páginas, experiências e conversões.
              </p>
            </div>
            <Link
              href={addPageHref}
              className={cn(buttonVariants({ variant: "primary" }), "!gap-1.5")}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Adicionar página
            </Link>
          </header>

          <div className="lp-pages-toolbar">
            <SearchInput
              size="toolbar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Encontrar páginas"
              aria-label="Encontrar páginas"
            />
          </div>

          {filteredProducts.length === 0 ? (
            <div className="lp-pages-empty">
              <EmptyState
                title={
                  pages.length === 0
                    ? "Nenhuma página ainda"
                    : "Nenhum resultado"
                }
                body={
                  pages.length === 0
                    ? "Crie uma landing page com formulário ou checkout. O link público fica pronto na hora."
                    : "Tente outro termo de busca."
                }
              />
              {pages.length === 0 ? (
                <div className="mt-4 flex justify-center">
                  <Link
                    href={addPageHref}
                    className={cn(
                      buttonVariants({ variant: "primary" }),
                      "!gap-1.5",
                    )}
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.75} />
                    Adicionar página
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="lp-pages-list">
              {filteredProducts.map((p) => (
                <li key={p.id} className="lp-page-row">
                  <PageThumb name={p.name} />
                  <div className="lp-page-row-main">
                    <div className="lp-page-row-title">
                      <p className="type-caption-strong text-[var(--ink)] truncate">
                        {p.name}
                      </p>
                      <span className="lp-page-status type-micro-legal">
                        {statusLabel(p.status)}
                      </span>
                    </div>
                    <UrlChip path={`/p/${p.slug}`} />
                  </div>
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
                    <Link
                      href={`/criar/paginas/${encodeURIComponent(p.id)}`}
                      className={buttonVariants({ variant: "secondary-pill" })}
                    >
                      Editar design
                    </Link>
                    <a
                      href={`/p/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-chip-translucent)] text-[var(--ink)] transition active:scale-95"
                      aria-label="Abrir página"
                      title="Abrir página"
                    >
                      <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                    </a>
                    <button
                      type="button"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-chip-translucent)] text-[var(--ink)] transition active:scale-95"
                      aria-label="Pedidos"
                      title="Pedidos"
                      onClick={() => setTab("pedidos")}
                    >
                      <BarChart3 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    <IconButton aria-label="Mais opções" type="button">
                      <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "pedidos" && !isLoading ? (
        <section className="mt-5 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--canvas)]">
          <div className="border-b border-[var(--hairline)] px-4 py-3">
            <h2 className="type-body-strong text-[var(--ink)]">Pedidos</h2>
          </div>
          {orders.length === 0 ? (
            <EmptyState
              title="Nenhum pedido ainda"
              body="Compartilhe o link de checkout de um produto para começar a receber vendas."
            />
          ) : (
            <ul className="divide-y divide-[var(--divider-soft)]">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="type-caption-strong text-[var(--ink)]">
                      {o.name || o.email}
                    </p>
                    <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                      {statusLabel(o.status)} ·{" "}
                      {new Date(o.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <p className="type-body-strong tabular-nums text-[var(--ink)]">
                    {brl(o.totalCents)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "ofertas" && !isLoading ? (
        <>
          <div className="utility-card mt-5 flex flex-wrap items-center justify-between gap-3 !p-4 sm:!p-5">
            <div>
              <h2 className="type-body-strong text-[var(--ink)]">
                Upsells ativos
              </h2>
              <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">
                Order bump e pós-compra. Crie em Criar → Upsell.
              </p>
            </div>
            <Link
              href="/criar/upsell?mode=manual"
              className={buttonVariants({ variant: "primary" })}
            >
              Novo upsell
            </Link>
          </div>
          <section className="mt-4 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--canvas)]">
            {offers.length === 0 ? (
              <EmptyState
                title="Nenhum upsell ainda"
                body="Crie um order bump ou upsell em Criar para aumentar o ticket médio."
              />
            ) : (
              <ul className="divide-y divide-[var(--divider-soft)]">
                {offers.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="type-caption-strong text-[var(--ink)]">
                        {o.triggerProduct.name}
                        <span className="text-[var(--ink-muted-48)]"> → </span>
                        {o.offeredProduct.name}
                      </p>
                      <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                        {offerTypeLabel(o.type)}
                      </p>
                    </div>
                    <span className="rounded-sm bg-[var(--canvas-parchment)] px-2 py-0.5 type-caption-strong text-[var(--ink)]">
                      −{o.discountPercent}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {tab === "cupons" && !isLoading ? (
        <>
          <div className="utility-card mt-5 flex flex-wrap items-center justify-between gap-3 !p-4 sm:!p-5">
            <div>
              <h2 className="type-body-strong text-[var(--ink)]">Cupons</h2>
              <p className="mt-0.5 type-fine-print text-[var(--ink-muted-48)]">
                Crie em Criar → Cupom. Aqui você acompanha o uso.
              </p>
            </div>
            <Link
              href="/criar/cupom?mode=manual"
              className={buttonVariants({ variant: "primary" })}
            >
              Novo cupom
            </Link>
          </div>
          <section className="mt-4 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--canvas)]">
            {coupons.length === 0 ? (
              <EmptyState
                title="Nenhum cupom ainda"
                body="Crie um código de desconto em Criar → Cupom."
              />
            ) : (
              <ul className="divide-y divide-[var(--divider-soft)]">
                {coupons.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <p className="type-caption-strong text-[var(--ink)]">
                      {c.code}
                    </p>
                    <p className="type-fine-print text-[var(--ink-muted-48)]">
                      {c.type === "PERCENT" ? `${c.value}%` : brl(c.value)} ·{" "}
                      {c.usedCount} uso{c.usedCount === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </AppPage>
  );
}
