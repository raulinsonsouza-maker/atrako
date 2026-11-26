"use client";

import { Suspense, useCallback, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { FormField } from "@atrako/forms";
import { CheckoutForm, type CheckoutVariantOption } from "@/components/commerce/CheckoutForm";
import { LpLeadForm } from "@/components/commerce/LpLeadForm";
import { MattressLayersBlock } from "@/components/commerce/MattressLayersBlock";
import { ProductGallery } from "@/components/commerce/ProductGallery";
import { LP_V3_SCOPE, googleFontsHref, renderSlots, type LpSalesPageV3 } from "@/lib/criar/lp-v3";
import { withUtm } from "@/lib/atrako-agent/images-core";
import { LpFxRuntime } from "@/components/commerce/lp-fx/LpFxRuntime";
import "@/styles/lp-fx/fx.css";
import type { LpCheckoutBump, LpPuckProduct } from "@/lib/criar/puck/context";

function formatLivePrice(cents: number, currency: string) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function writeLivePrices(root: HTMLElement, kind: "pix" | "card", label: string) {
  root.querySelectorAll(`[data-atrako-live-price="${kind}"]`).forEach((el) => {
    el.textContent = label;
  });
}

type Props = {
  page: LpSalesPageV3;
  product: LpPuckProduct & { maxInstallments?: number | null; type?: string };
  brandName: string;
  currency?: string;
  mpPublicKey?: string | null;
  form?: { slug: string | null; name: string; fields: FormField[] } | null;
  checkoutProduct?: LpPuckProduct | null;
  bump?: LpCheckoutBump | null;
  previewToken?: string | null;
  variants?: CheckoutVariantOption[];
};

/**
 * LP v3 / Pages: HTML/CSS no DB + formulário, checkout, gallery e layers via portal.
 */
export function SalesPageHtmlView({
  page,
  product,
  brandName,
  currency = "BRL",
  mpPublicKey = null,
  form = null,
  checkoutProduct = null,
  bump = null,
  previewToken = null,
  variants = [],
}: Props) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const inner = useMemo(() => ({ __html: renderSlots(page.html) }), [page.html]);
  const html = inner.__html;
  const [slots, setSlots] = useState<{
    form: HTMLElement | null;
    checkout: HTMLElement | null;
    gallery: HTMLElement | null;
    layers: HTMLElement | null;
  }>({ form: null, checkout: null, gallery: null, layers: null });

  useLayoutEffect(() => {
    if (!root) return;
    setSlots({
      form: root.querySelector<HTMLElement>('[data-atrako-slot="form"]'),
      checkout: root.querySelector<HTMLElement>('[data-atrako-slot="checkout"]'),
      gallery: root.querySelector<HTMLElement>('[data-atrako-slot="gallery"]'),
      layers: root.querySelector<HTMLElement>('[data-atrako-slot="layers"]'),
    });
  }, [root, html]);

  const fontsHref = googleFontsHref(page.fonts ?? []);
  const accent = page.theme?.accent;
  const accentInk = page.theme?.accentInk;
  const vars = useMemo(
    () => (accent ? { "--primary": accent, "--on-primary": accentInk ?? "#ffffff" } : {}) as CSSProperties,
    [accent, accentInk],
  );
  const css = useMemo(() => ({ __html: page.css }), [page.css]);
  const buyable = checkoutProduct ?? (page.goal === "sales" && product.priceCents > 0 ? product : null);
  const physical = (buyable?.type || product.type || "").toUpperCase() === "PHYSICAL";
  const pixPct = page.pixDiscountPercent ?? 0;

  const onCheckoutTotals = useCallback(
    (totals: { pixCents: number; cardCents: number; currency: string }) => {
      if (!root) return;
      writeLivePrices(root, "pix", formatLivePrice(totals.pixCents, totals.currency));
      writeLivePrices(root, "card", formatLivePrice(totals.cardCents, totals.currency));
    },
    [root],
  );

  useLayoutEffect(() => {
    if (!root || !buyable) return;
    const base = variants[0]?.priceCents ?? buyable.priceCents;
    const pct = Math.min(100, Math.max(0, Math.round(pixPct)));
    const pix = pct > 0 ? Math.max(0, base - Math.round((base * pct) / 100)) : base;
    writeLivePrices(root, "pix", formatLivePrice(pix, currency));
    writeLivePrices(root, "card", formatLivePrice(base, currency));
  }, [root, buyable, variants, pixPct, currency]);

  return (
    <>
      {fontsHref ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={fontsHref} />
        </>
      ) : null}
      <style dangerouslySetInnerHTML={css} />
      <div
        ref={setRoot}
        className={LP_V3_SCOPE}
        data-surface={page.theme?.surface ?? "light"}
        style={vars}
        dangerouslySetInnerHTML={inner}
      />
      <LpFxRuntime root={root} html={html} />
      {page.images?.length ? (
        <p className={`${LP_V3_SCOPE} fx-credits`}>
          Fotos de{" "}
          {page.images.map((img, index) => (
            <span key={img.id}>
              {index > 0 ? ", " : ""}
              <a href={withUtm(img.authorUrl)} target="_blank" rel="noopener noreferrer">
                {img.author}
              </a>
            </span>
          ))}{" "}
          no{" "}
          <a href={withUtm(page.images[0]?.photoUrl || "https://unsplash.com")} target="_blank" rel="noopener noreferrer">
            Unsplash
          </a>
        </p>
      ) : null}
      {slots.form
        ? createPortal(
            <LpLeadForm
              title=""
              formSlug={form?.slug ?? null}
              fields={form?.fields ?? null}
              workspaceId={product.clienteId}
              productId={product.id}
              pageSlug={product.slug}
              previewToken={previewToken}
            />,
            slots.form,
          )
        : null}
      {slots.gallery && page.gallery?.length
        ? createPortal(<ProductGallery mode="hero" images={page.gallery} />, slots.gallery)
        : null}
      {slots.layers && page.layers?.length
        ? createPortal(
            <MattressLayersBlock
              title={page.layersTitle || "Por dentro do seu conforto"}
              hint={page.layersHint || "Toque na camada para ver como ela melhora seu sono"}
              layers={page.layers}
            />,
            slots.layers,
          )
        : null}
      {slots.checkout && buyable
        ? createPortal(
            <Suspense fallback={<p className="type-caption text-[var(--ink-muted-48)]">…</p>}>
              <CheckoutForm
                product={{
                  id: buyable.id,
                  name: buyable.name,
                  slug: buyable.slug,
                  priceCents: buyable.priceCents,
                  description: buyable.description,
                  type: buyable.type,
                  maxInstallments: product.maxInstallments,
                }}
                brandName={brandName}
                currency={currency}
                mpPublicKey={mpPublicKey}
                bump={bump}
                pageProductId={product.id}
                pageSlug={product.slug}
                previewToken={previewToken}
                variants={variants}
                pixDiscountPercent={pixPct}
                requireAddress={physical}
                onTotalsChange={onCheckoutTotals}
              />
            </Suspense>,
            slots.checkout,
          )
        : null}
    </>
  );
}
