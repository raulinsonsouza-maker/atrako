"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StorefrontChrome } from "@/components/commerce/StorefrontChrome";
import { buttonVariants } from "@/components/ui/button";
import {
  readStoreCart,
  setStoreCartQty,
  type StoreCartLineClient,
} from "@/lib/commerce/cart-client";
import type { StoreTheme } from "@/lib/commerce/theme";
import { cn } from "@/lib/utils";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function StoreCartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [lines, setLines] = useState<StoreCartLineClient[]>([]);

  const { data } = useQuery({
    queryKey: ["store-public", slug],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/public/${slug}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        store: {
          id: string;
          slug: string;
          name: string;
          freeShippingMinCents?: number | null;
          theme?: StoreTheme;
        };
        brand: { primaryColor?: string | null } | null;
        categories: { id: string; name: string; slug: string }[];
      }>;
    },
  });

  useEffect(() => {
    if (!data?.store.id) return;
    setLines(readStoreCart(data.store.id));
  }, [data?.store.id]);

  if (!data) return <p className="p-8 type-caption">Carregando…</p>;

  const subtotal = lines.reduce((s, l) => s + l.priceCents * l.quantity, 0);

  return (
    <StorefrontChrome
      storeId={data.store.id}
      storeSlug={data.store.slug}
      storeName={data.store.name}
      primaryColor={data.brand?.primaryColor || "#cc0000"}
      categories={data.categories}
      freeShippingMinCents={data.store.freeShippingMinCents}
      theme={data.store.theme}
    >
      <h1 className="store-section-title" style={{ marginTop: "1.5rem", textAlign: "left" }}>
        Carrinho
      </h1>

      {lines.length === 0 ? (
        <div className="mt-6">
          <p className="type-caption text-[var(--ink-muted-48)]">Seu carrinho está vazio.</p>
          <Link href={`/loja/${slug}`} className={cn(buttonVariants({ variant: "primary" }), "mt-4 inline-flex")}>
            Continuar comprando
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-5 divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white">
            {lines.map((line) => (
              <li key={`${line.productId}-${line.variantId}`} className="flex gap-3 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-[var(--canvas)]">
                  {line.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="type-body-strong">{line.name}</p>
                  {line.optionsLabel ? (
                    <p className="type-fine-print text-[var(--ink-muted-48)]">{line.optionsLabel}</p>
                  ) : null}
                  <p className="mt-1 type-caption tabular-nums">{brl(line.priceCents)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-[var(--radius-xs)] bg-[var(--canvas)] type-body-strong"
                      onClick={() =>
                        setLines(
                          setStoreCartQty(
                            data.store.id,
                            line.productId,
                            line.variantId,
                            line.quantity - 1,
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    <span className="tabular-nums type-body">{line.quantity}</span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-[var(--radius-xs)] bg-[var(--canvas)] type-body-strong"
                      onClick={() =>
                        setLines(
                          setStoreCartQty(
                            data.store.id,
                            line.productId,
                            line.variantId,
                            line.quantity + 1,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="type-body-strong tabular-nums">
                  {brl(line.priceCents * line.quantity)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between">
            <p className="type-body">Subtotal</p>
            <p className="type-body-strong tabular-nums">{brl(subtotal)}</p>
          </div>
          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
            Frete calculado no checkout.
          </p>
          <Link
            href={`/loja/${slug}/checkout`}
            className={cn(buttonVariants({ variant: "primary" }), "mt-4 inline-flex")}
          >
            Finalizar compra
          </Link>
        </>
      )}
    </StorefrontChrome>
  );
}
