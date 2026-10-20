"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, LayoutTemplate, Loader2, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { UrlChip } from "@/components/criar/CopyLinkButton";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";
import { isLpSalesPageV1, isLpSalesPageV2 } from "@/lib/criar/lp-schema";

type Product = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  status: string;
  salesPage?: unknown;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CommercePagesPage() {
  const { workspaceId } = useActiveWorkspace();
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-data", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ products: Product[]; mpConnected?: boolean }>;
    },
  });

  const pages = useMemo(() => {
    const products = (data?.products ?? []).filter(
      (p) => isLpSalesPageV2(p.salesPage) || isLpSalesPageV1(p.salesPage),
    );
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [data?.products, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-tagline text-[var(--ink)]">Páginas</h1>
          <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
            Landing pages e checkout de infoproduto (1 produto).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SearchInput
            size="toolbar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
            className="w-44"
          />
          <Link
            href="/criar/oferta?mode=manual"
            className={cn(buttonVariants({ variant: "primary" }), "!gap-1.5")}
          >
            <Plus className="h-4 w-4" />
            Adicionar página
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : pages.length === 0 ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Nenhuma página digital ainda.</p>
      ) : (
        <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white">
          {pages.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--canvas)]">
                <LayoutTemplate className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="type-body-strong truncate">{p.name}</p>
                <p className="type-fine-print text-[var(--ink-muted-48)]">
                  {brl(p.priceCents)} · {p.status}
                </p>
                <div className="mt-1">
                  <UrlChip path={`/p/${p.slug}`} />
                </div>
              </div>
              <Link
                href={`/p/${p.slug}`}
                target="_blank"
                className="text-[var(--ink-muted-48)]"
                aria-label="Abrir"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
