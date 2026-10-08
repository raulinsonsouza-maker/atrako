"use client";

import { Suspense, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { FormField } from "@atrako/forms";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";
import { LpLeadForm } from "@/components/commerce/LpLeadForm";
import { LP_V3_SCOPE, googleFontsHref, renderSlots, type LpSalesPageV3 } from "@/lib/criar/lp-v3";
import { withUtm } from "@/lib/atrako-agent/images-core";
import { LpFxRuntime } from "@/components/commerce/lp-fx/LpFxRuntime";
import "@/styles/lp-fx/fx.css";
import type { LpCheckoutBump, LpPuckProduct } from "@/lib/criar/puck/context";

type Props = {
  page: LpSalesPageV3;
  product: LpPuckProduct;
  brandName: string;
  currency?: string;
  mpPublicKey?: string | null;
  form?: { slug: string | null; name: string; fields: FormField[] } | null;
  checkoutProduct?: LpPuckProduct | null;
  bump?: LpCheckoutBump | null;
  previewToken?: string | null;
};

/**
 * LP v3: HTML/CSS da IA (já sanitizados e com escopo no servidor) + formulário e
 * checkout nativos montados nos marcadores via portal.
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
}: Props) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  /* Objeto estável: um `{ __html }` novo a cada render faz o React reescrever o innerHTML e soltar os portais. */
  const inner = useMemo(() => ({ __html: renderSlots(page.html) }), [page.html]);
  const html = inner.__html;
  const [slots, setSlots] = useState<{ form: HTMLElement | null; checkout: HTMLElement | null }>({
    form: null,
    checkout: null,
  });

  /* Ref em estado: na hidratação o efeito pode rodar antes do ref existir; assim ele roda de novo. */
  useLayoutEffect(() => {
    if (!root) return;
    setSlots({
      form: root.querySelector<HTMLElement>('[data-atrako-slot="form"]'),
      checkout: root.querySelector<HTMLElement>('[data-atrako-slot="checkout"]'),
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
                }}
                brandName={brandName}
                currency={currency}
                mpPublicKey={mpPublicKey}
                bump={bump}
                pageProductId={product.id}
                pageSlug={product.slug}
                previewToken={previewToken}
              />
            </Suspense>,
            slots.checkout,
          )
        : null}
    </>
  );
}
