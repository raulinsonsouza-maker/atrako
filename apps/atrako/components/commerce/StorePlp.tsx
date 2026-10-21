"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Percent,
  ShieldCheck,
  Truck,
  Package,
} from "lucide-react";
import { StorefrontChrome } from "@/components/commerce/StorefrontChrome";
import { StoreHero } from "@/components/commerce/StoreHero";
import { StoreProductCard } from "@/components/commerce/StoreProductCard";
import type { PublicStoreCatalog } from "@/lib/commerce/public-catalog";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function StorePlp({ catalog }: { catalog: PublicStoreCatalog }) {
  const [q, setQ] = useState("");

  const products = useMemo(() => {
    let list = catalog.products;
    const query = q.trim().toLowerCase();
    if (query) list = list.filter((p) => p.name.toLowerCase().includes(query));
    return list;
  }, [catalog.products, q]);

  const filtering = Boolean(q.trim());
  const flagged = products.filter((p) => p.badges?.featured);
  const featured = filtering ? [] : (flagged.length > 0 ? flagged.slice(0, 8) : products.slice(0, 4));
  const featuredIds = new Set(featured.map((p) => p.id));
  const rest = filtering ? products : products.filter((p) => !featuredIds.has(p.id));
  const freeMin = catalog.store.freeShippingMinCents;

  return (
    <StorefrontChrome
      storeId={catalog.store.id}
      storeSlug={catalog.store.slug}
      storeName={catalog.store.name}
      primaryColor={catalog.brand?.primaryColor || "#cc0000"}
      categories={catalog.categories}
      searchValue={q}
      onSearch={setQ}
      freeShippingMinCents={freeMin}
      theme={catalog.store.theme}
      hero={<StoreHero banners={catalog.store.banners} />}
    >
      {!catalog.store.acceptingOrders ? (
        <p className="type-caption text-[var(--ink-muted-48)]" style={{ marginTop: "1rem" }}>
          Loja temporariamente pausada — você ainda pode navegar no catálogo.
        </p>
      ) : null}

      <section className="store-trust" id="vantagens" aria-label="Vantagens">
        <div className="store-trust__item">
          <Truck className="h-6 w-6" strokeWidth={1.75} />
          <div>
            <strong>Frete grátis</strong>
            <span>
              {freeMin != null && freeMin > 0 ? brl(freeMin) : "regiões selecionadas"}
            </span>
          </div>
        </div>
        <div className="store-trust__item">
          <Percent className="h-6 w-6" strokeWidth={1.75} />
          <div>
            <strong>Descontos</strong>
            <span>em pagamentos à vista</span>
          </div>
        </div>
        <div className="store-trust__item">
          <Package className="h-6 w-6" strokeWidth={1.75} />
          <div>
            <strong>Retirada</strong>
            <span>combinar no estúdio</span>
          </div>
        </div>
        <div className="store-trust__item">
          <CreditCard className="h-6 w-6" strokeWidth={1.75} />
          <div>
            <strong>Pague com cartão</strong>
            <span>em até 3x s/ juros</span>
          </div>
        </div>
        <div className="store-trust__item">
          <ShieldCheck className="h-6 w-6" strokeWidth={1.75} />
          <div>
            <strong>Segurança</strong>
            <span>checkout Mercado Pago</span>
          </div>
        </div>
      </section>

      {catalog.categories.length > 0 ? (
        <section aria-label="Categorias">
          <h2 className="store-section-title">Qual deles tem o seu coração?</h2>
          <div className="store-cats">
            {catalog.categories.map((c) => (
              <Link key={c.id} href={`/loja/${catalog.store.slug}/c/${c.slug}`} className="store-cat">
                <div className="store-cat__circle">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" />
                  ) : (
                    initials(c.name)
                  )}
                </div>
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {featured.length > 0 ? (
        <section aria-label="Em alta">
          <h2 className="store-section-title">Tá todo mundo falando!</h2>
          <div className="store-grid">
            {featured.map((p, i) => (
              <StoreProductCard
                key={p.id}
                storeId={catalog.store.id}
                storeSlug={catalog.store.slug}
                product={p}
                isNew={p.badges?.launch}
                highlight={p.badges?.featured}
                extraBadge={p.badges?.extra}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section id="catalogo" aria-label="Catálogo">
        {filtering || rest.length > 0 ? (
          <h2 className="store-section-title">{filtering ? "Busca" : "Destaques"}</h2>
        ) : null}
        {filtering && rest.length === 0 ? (
          <p className="type-caption text-center text-[var(--ink-muted-48)]">
            Nenhum produto nesta seleção.
          </p>
        ) : rest.length > 0 ? (
          <div className="store-grid">
            {rest.map((p, i) => (
              <StoreProductCard
                key={`all-${p.id}`}
                storeId={catalog.store.id}
                storeSlug={catalog.store.slug}
                product={p}
                isNew={p.badges?.launch}
                highlight={p.badges?.featured}
                extraBadge={p.badges?.extra}
              />
            ))}
          </div>
        ) : null}
      </section>
    </StorefrontChrome>
  );
}
