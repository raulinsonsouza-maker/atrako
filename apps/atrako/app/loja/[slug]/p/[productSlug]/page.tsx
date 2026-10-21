"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StorefrontChrome } from "@/components/commerce/StorefrontChrome";
import { StoreProductCard } from "@/components/commerce/StoreProductCard";
import {
  StoreProductGallery,
  type GalleryImage,
} from "@/components/commerce/StoreProductGallery";
import { PillSelect } from "@/components/ui/pill-select";
import { addToStoreCart } from "@/lib/commerce/cart-client";
import type { StoreTheme } from "@/lib/commerce/theme";
import type { PublicStoreCatalog } from "@/lib/commerce/public-catalog";

type Pdp = {
  store: { id: string; slug: string; name: string; acceptingOrders: boolean; theme?: StoreTheme };
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    priceCents: number;
    coverUrl: string | null;
    images: { src?: string; alt?: string }[] | unknown;
    stockTracked: boolean;
    badges?: { featured: boolean; launch: boolean; extra: string | null };
    category: { id: string; name: string; slug: string } | null;
    variants: {
      id: string;
      sku: string | null;
      options: Record<string, string>;
      priceCents: number | null;
      stockQty: number;
    }[];
  };
  brand: { primaryColor?: string | null } | null;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function optionsLabel(options: Record<string, string>) {
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

function collectImages(product: Pdp["product"]): GalleryImage[] {
  const out: GalleryImage[] = [];
  if (product.coverUrl) out.push({ src: product.coverUrl, alt: product.name });
  if (Array.isArray(product.images)) {
    for (const row of product.images as { src?: string; alt?: string; kind?: string }[]) {
      if (row?.src) {
        out.push({
          src: row.src,
          alt: row.alt || product.name,
          kind: row.kind === "video" ? "video" : undefined,
        });
      }
    }
  }
  return out;
}

type TabId = "descricao" | "pagamento" | "envio";

export default function StorePdpPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = use(params);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [tab, setTab] = useState<TabId>("descricao");
  const [cep, setCep] = useState("");
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [shipLoading, setShipLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["store-pdp", slug, productSlug],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/public/${slug}/products/${productSlug}`);
      if (!r.ok) throw new Error("Produto não encontrado");
      return r.json() as Promise<Pdp>;
    },
  });

  const catalogQ = useQuery({
    queryKey: ["store-public", slug],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/public/${slug}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<PublicStoreCatalog>;
    },
  });

  const variant = useMemo(() => {
    if (!data) return null;
    if (!data.product.variants.length) return null;
    return data.product.variants.find((v) => v.id === variantId) ?? data.product.variants[0];
  }, [data, variantId]);

  const priceCents = variant?.priceCents ?? data?.product.priceCents ?? 0;
  const inStock =
    !data?.product.stockTracked ||
    !data.product.variants.length ||
    (variant ? variant.stockQty > 0 : false);

  if (isLoading) return <p className="p-8 type-caption">Carregando…</p>;
  if (error || !data) return <p className="p-8 type-body">Produto indisponível.</p>;

  const gallery = collectImages(data.product);
  const cover = gallery[0]?.src ?? null;
  const pixCents = Math.round(priceCents * 0.93);
  const sku = variant?.sku ?? null;
  const related =
    catalogQ.data?.products
      .filter((p) => p.id !== data.product.id)
      .filter((p) =>
        data.product.category
          ? p.categoryId === data.product.category.id
          : true,
      )
      .slice(0, 4) ?? [];

  async function calcShipping() {
    setShipLoading(true);
    setShipMsg(null);
    try {
      const r = await fetch(
        `/api/atrako/commerce/public/${slug}/shipping?cep=${encodeURIComponent(cep)}&subtotalCents=${priceCents}`,
      );
      const json = (await r.json()) as {
        shipping?: {
          available: boolean;
          reason?: string;
          feeCents?: number;
          daysMin?: number | null;
          daysMax?: number | null;
          freeShippingApplied?: boolean;
          zoneName?: string | null;
        };
      };
      const s = json.shipping;
      if (!s?.available) {
        setShipMsg(s?.reason || "Não foi possível calcular o frete.");
        return;
      }
      const prazo =
        s.daysMin != null && s.daysMax != null
          ? ` · ${s.daysMin}–${s.daysMax} dias úteis`
          : "";
      const fee =
        s.freeShippingApplied || s.feeCents === 0
          ? "Frete grátis"
          : brl(s.feeCents ?? 0);
      setShipMsg(`${fee}${prazo}${s.zoneName ? ` (${s.zoneName})` : ""}`);
    } catch {
      setShipMsg("Falha ao calcular.");
    } finally {
      setShipLoading(false);
    }
  }

  return (
    <StorefrontChrome
      storeId={data.store.id}
      storeSlug={data.store.slug}
      storeName={data.store.name}
      primaryColor={data.brand?.primaryColor || "#cc0000"}
      categories={catalogQ.data?.categories}
      freeShippingMinCents={catalogQ.data?.store.freeShippingMinCents}
      theme={data.store.theme}
    >
      <nav className="store-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/loja/${slug}`}>Home</Link>
        <span>›</span>
        {data.product.category ? (
          <>
            <Link href={`/loja/${slug}/c/${data.product.category.slug}`}>{data.product.category.name}</Link>
            <span>›</span>
          </>
        ) : null}
        <span>{data.product.name}</span>
      </nav>

      <div className="store-pdp">
        <StoreProductGallery images={gallery} productName={data.product.name} />

        <div className="store-pdp__info">
          <h1 className="store-pdp__title">{data.product.name}</h1>
          {data.product.badges?.launch || data.product.badges?.featured || data.product.badges?.extra ? (
            <div className="store-pdp__badges">
              {data.product.badges.launch ? <span className="store-badge">Lançamento</span> : null}
              {data.product.badges.featured ? <span className="store-badge">Destaque</span> : null}
              {data.product.badges.extra ? (
                <span className="store-badge">{data.product.badges.extra}</span>
              ) : null}
            </div>
          ) : null}
          <div className="store-pdp__meta">
            {sku ? <span>REF: {sku}</span> : null}
            <span>{priceCents <= 0 ? "Sob consulta" : inStock ? "Disponibilidade: Imediata" : "Indisponível"}</span>
          </div>

          {priceCents <= 0 ? (
            <p className="store-pdp__price">Sob consulta</p>
          ) : (
            <>
              <p className="store-pdp__price">{brl(priceCents)}</p>
              <p className="store-pdp__pay">
                {brl(pixCents)} à vista com desconto Pix ou 3x de {brl(Math.round(priceCents / 3))} sem juros
              </p>
            </>
          )}

          {data.product.variants.length > 0 ? (
            <div className="store-pdp__variant">
              <p className="store-pdp__label">Variação</p>
              <PillSelect
                size="field"
                value={variant?.id ?? ""}
                onChange={setVariantId}
                options={data.product.variants.map((v) => ({
                  value: v.id,
                  label: `${optionsLabel(v.options || {}) || "Padrão"}${
                    data.product.stockTracked ? ` (${v.stockQty})` : ""
                  }`,
                }))}
              />
            </div>
          ) : null}

          {priceCents > 0 ? (
          <div className="store-pdp__actions">
            <div className="store-qty">
              <button
                type="button"
                aria-label="Diminuir"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </button>
              <span>{qty}</span>
              <button
                type="button"
                aria-label="Aumentar"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
              >
                +
              </button>
            </div>
            <button
              type="button"
              disabled={!data.store.acceptingOrders || !inStock}
              className="store-buy"
              onClick={() => {
                addToStoreCart(data.store.id, {
                  productId: data.product.id,
                  variantId: variant?.id ?? null,
                  name: data.product.name,
                  imageUrl: cover,
                  priceCents,
                  quantity: qty,
                  optionsLabel: variant ? optionsLabel(variant.options || {}) : null,
                });
                setAdded(true);
              }}
            >
              {!inStock ? "Sem estoque" : added ? "Adicionado" : "Comprar"}
            </button>
          </div>
          ) : null}
          {added ? (
            <Link href={`/loja/${slug}/carrinho`} className="store-pdp__cart">
              Ver carrinho
            </Link>
          ) : null}

          <div className="store-ship-box">
            <h3>Frete e prazo de entrega</h3>
            <div className="store-ship-box__row">
              <input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="Informe seu CEP"
                inputMode="numeric"
                aria-label="CEP"
              />
              <button type="button" disabled={shipLoading} onClick={() => void calcShipping()}>
                {shipLoading ? "…" : "Calcular"}
              </button>
            </div>
            {shipMsg ? <p className="store-ship-box__result">{shipMsg}</p> : null}
          </div>
        </div>
      </div>

      <div className="store-tabs">
        <div className="store-tabs__nav" role="tablist">
          {(
            [
              ["descricao", "Descrição geral"],
              ["pagamento", "Formas de pagamento"],
              ["envio", "Envio"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={tab === id ? "is-active" : undefined}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="store-tabs__panel" role="tabpanel">
          {tab === "descricao" ? (
            <>
              <h3>{data.product.name}</h3>
              {data.product.description ? (
                <div
                  className="store-html"
                  dangerouslySetInnerHTML={{ __html: data.product.description }}
                />
              ) : (
                <p>Descrição em breve.</p>
              )}
            </>
          ) : null}
          {tab === "pagamento" ? (
            <p>
              Aceitamos Pix com desconto e cartão em até 3x sem juros via Mercado Pago no
              checkout da loja.
            </p>
          ) : null}
          {tab === "envio" ? (
            <p>
              Frete calculado por CEP na tabela da loja. Informe o CEP acima para ver prazo e
              valor. Retirada no estúdio pode estar disponível no checkout.
            </p>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="store-related" aria-label="Relacionados">
          <h2 className="store-section-title">Produtos relacionados</h2>
          <div className="store-grid">
            {related.map((p, i) => (
              <StoreProductCard
                key={p.id}
                storeId={data.store.id}
                storeSlug={data.store.slug}
                product={p}
                isNew={p.badges?.launch}
                highlight={p.badges?.featured}
                extraBadge={p.badges?.extra}
              />
            ))}
          </div>
        </section>
      ) : null}
    </StorefrontChrome>
  );
}
