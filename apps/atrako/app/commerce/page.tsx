"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Package, ShoppingBag, Truck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

export default function CommerceHomePage() {
  const { workspaceId } = useActiveWorkspace();
  const { data: storeData } = useQuery({
    queryKey: ["commerce-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/store?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        store: {
          name: string;
          publicUrl: string;
          _count?: { products: number; orders: number };
        } | null;
        mpConnected?: boolean;
      }>;
    },
  });
  const { data: catalog } = useQuery({
    queryKey: ["commerce-catalog", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/catalog?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ products: unknown[]; categories: unknown[] }>;
    },
  });

  const store = storeData?.store;
  const productCount = catalog?.products?.length ?? store?._count?.products ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-tagline text-[var(--ink)]">Loja</h1>
        <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
          Vitrine, catálogo, frete e pedidos no mesmo módulo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
          <Package className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
          <p className="mt-3 type-caption text-[var(--ink-muted-48)]">Produtos</p>
          <p className="type-body-strong tabular-nums">{productCount}</p>
        </div>
        <div className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
          <ShoppingBag className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
          <p className="mt-3 type-caption text-[var(--ink-muted-48)]">Mercado Pago</p>
          <p className="type-body-strong">
            {storeData?.mpConnected ? "Conectado" : "Pendente"}
          </p>
        </div>
        <div className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
          <Truck className="h-4 w-4 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
          <p className="mt-3 type-caption text-[var(--ink-muted-48)]">Frete</p>
          <p className="type-body-strong">Tabela fixa</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {store?.publicUrl ? (
          <Link
            href={store.publicUrl}
            target="_blank"
            className={cn(buttonVariants({ variant: "primary" }), "!gap-1.5")}
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            Abrir vitrine
          </Link>
        ) : null}
        <Link href="/commerce/produtos" className={cn(buttonVariants({ variant: "outline" }))}>
          Gerenciar produtos
        </Link>
        <Link href="/commerce/frete" className={cn(buttonVariants({ variant: "outline" }))}>
          Configurar frete
        </Link>
        <Link href="/commerce/banners" className={cn(buttonVariants({ variant: "outline" }))}>
          Banners
        </Link>
        <Link href="/commerce/paginas" className={cn(buttonVariants({ variant: "outline" }))}>
          Páginas digitais
        </Link>
      </div>
    </div>
  );
}