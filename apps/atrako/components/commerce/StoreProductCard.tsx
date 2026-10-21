"use client";

import { useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { addToStoreCart } from "@/lib/commerce/cart-client";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type StoreCardProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  coverUrl: string | null;
  stockTracked: boolean;
  variants: {
    id: string;
    priceCents: number | null;
    stockQty: number;
  }[];
};

export function StoreProductCard({
  storeId,
  storeSlug,
  product,
  highlight,
  isNew,
  extraBadge,
}: {
  storeId: string;
  storeSlug: string;
  product: StoreCardProduct;
  highlight?: boolean;
  isNew?: boolean;
  extraBadge?: string | null;
}) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = product.variants[0] ?? null;
  const priceCents = variant?.priceCents ?? product.priceCents;
  const pixCents = Math.round(priceCents * 0.93);
  const stockQty = product.stockTracked
    ? product.variants.length
      ? product.variants.reduce((s, v) => s + v.stockQty, 0)
      : 99
    : 99;
  const inStock = stockQty > 0;
  const consult = priceCents <= 0;
  const href = `/loja/${storeSlug}/p/${product.slug}`;

  function buy() {
    if (!inStock) return;
    addToStoreCart(storeId, {
      productId: product.id,
      variantId: variant?.id ?? null,
      name: product.name,
      imageUrl: product.coverUrl,
      priceCents,
      quantity: qty,
      optionsLabel: null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <article className="store-card">
      <Link href={href} className="store-card__media">
        {product.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.coverUrl} alt="" className="shadow-product" />
        ) : (
          <div className="store-card__placeholder">Sem imagem</div>
        )}
      </Link>
      {(isNew || highlight) && (
        <div className="store-card__badges">
          {isNew ? <span className="store-badge">Lançamento</span> : null}
          {highlight ? <span className="store-badge">Destaque</span> : null}
          {extraBadge ? <span className="store-badge">{extraBadge}</span> : null}
        </div>
      )}
      <Link href={href} className="store-card__name">
        {product.name}
      </Link>
      <div className="store-card__stars" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-3 w-3" strokeWidth={1.5} />
        ))}
      </div>
      <p className="store-card__price">{consult ? "Sob consulta" : brl(priceCents)}</p>
      {consult ? null : (
        <p className="store-card__pix">
          {brl(pixCents)} à vista com desconto Pix
          <br />
          ou 3x de {brl(Math.round(priceCents / 3))} sem juros
        </p>
      )}
      {consult ? null : inStock ? (
        <div className="store-card__actions">
          <div className="store-qty">
            <button type="button" aria-label="Diminuir" onClick={() => setQty((q) => Math.max(1, q - 1))}>
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
          <button type="button" className="store-buy" onClick={buy}>
            {added ? "Adicionado" : "Comprar"}
          </button>
        </div>
      ) : (
        <p className="store-card__oos">Esse acabou :(</p>
      )}
    </article>
  );
}
