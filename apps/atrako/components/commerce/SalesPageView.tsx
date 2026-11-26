"use client";

import { Suspense, useMemo } from "react";
import { CheckoutForm, type CheckoutVariantOption } from "@/components/commerce/CheckoutForm";
import { LpFaqAccordion } from "@/components/commerce/LpFaqAccordion";
import { LpLeadForm } from "@/components/commerce/LpLeadForm";
import { MattressLayersBlock } from "@/components/commerce/MattressLayersBlock";
import { MoodTitle } from "@/components/commerce/MoodTitle";
import { ProductGallery, type GalleryMedia } from "@/components/commerce/ProductGallery";
import { FloatingStickyBar } from "@/components/ui/floating-sticky-bar";
import type { LpSalesPageV1, LpSection } from "@/lib/criar/lp-schema";
import type { LpCheckoutBump, LpPuckProduct } from "@/lib/criar/puck/context";

export type SalesPageProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  description: string | null;
  clienteId: string;
  type?: string;
  kind?: string;
  maxInstallments?: number | null;
};

type Props = {
  page: LpSalesPageV1;
  product: SalesPageProduct;
  brandName: string;
  currency?: string;
  mpPublicKey?: string | null;
  formSlug?: string | null;
  checkoutProduct?: LpPuckProduct | null;
  bump?: LpCheckoutBump | null;
  preview?: boolean;
  variants?: CheckoutVariantOption[];
};

function brl(cents: number, currency: string) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function normalizeBenefit(item: string | { title: string; body?: string; icon?: string }) {
  if (typeof item === "string") {
    const [title, body] = item.split("|").map((s) => s.trim());
    return { title: title || item, body, icon: undefined };
  }
  return item;
}

function SectionBlock({
  section,
  product,
  brandName,
  currency,
  mpPublicKey,
  formSlug,
  page,
  preview,
  checkoutProduct,
  bump,
  variants,
  galleryImages,
}: {
  section: LpSection;
  product: SalesPageProduct;
  brandName: string;
  currency: string;
  mpPublicKey: string | null;
  formSlug?: string | null;
  page: LpSalesPageV1;
  preview?: boolean;
  checkoutProduct?: LpPuckProduct | null;
  bump?: LpCheckoutBump | null;
  variants?: CheckoutVariantOption[];
  galleryImages?: GalleryMedia[];
}) {
  switch (section.type) {
    case "hero":
      return (
        <section className="lp-mood-hero" id="top">
          <div className="lp-mood-hero__copy">
            {section.kicker ? <p className="lp-kicker">{section.kicker}</p> : null}
            <MoodTitle text={section.headline} as="h1" className="mood-display" />
            {section.subheadline ? <p className="lp-mood-lead">{section.subheadline}</p> : null}
            {section.checks?.length ? (
              <ul className="lp-mood-hero__checks">
                {section.checks.map((c) => (
                  <li key={c}>
                    <span className="lp-check" aria-hidden>
                      ✓
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            ) : null}
            <a href="#checkout" className="mood-btn-green">
              {section.ctaLabel || "Quero dormir melhor"} →
            </a>
            <p className="lp-mood-secure">
              <span className="lp-mood-secure__icon" aria-hidden>
                ◆
              </span>
              Compra segura
            </p>
          </div>
          {galleryImages?.length ? (
            <div className="lp-mood-hero__visual">
              <ProductGallery mode="hero" images={galleryImages} />
            </div>
          ) : section.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.mediaUrl} alt="" className="lp-mood-hero__fallback-img" />
          ) : null}
        </section>
      );
    case "gallery":
      return null;
    case "trust":
      return (
        <section className="lp-trust-bar" aria-label="Vantagens">
          {section.items.map((item) => (
            <div key={item.title} className="lp-trust-bar__item">
              <p className="lp-trust-bar__title">{item.title}</p>
              <p className="lp-trust-bar__body">{item.body}</p>
            </div>
          ))}
        </section>
      );
    case "benefits":
      return (
        <section className="lp-mood-benefits" id="beneficios">
          <div className="lp-mood-benefits__inner">
            {section.kicker ? <p className="lp-kicker lp-kicker--on-dark">{section.kicker}</p> : null}
            {section.title ? (
              <MoodTitle text={section.title} as="h2" className="mood-display mood-display--on-dark" />
            ) : null}
            {section.lead ? <p className="lp-mood-lead lp-mood-lead--on-dark">{section.lead}</p> : null}
            <div className="lp-benefit-stack">
              {section.items.map(normalizeBenefit).map((card, i) => (
                <article
                  key={`${i}-${card.title}`}
                  className={`lp-benefit-card${i === 0 ? " is-featured" : ""}`}
                >
                  <div className="lp-benefit-card__body">
                    <h3>{card.title}</h3>
                    {card.body ? <p>{card.body}</p> : null}
                  </div>
                  <span className="lp-benefit-card__num" aria-hidden>
                    {card.icon || String(i + 1).padStart(2, "0")}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>
      );
    case "mattress_layers":
      return (
        <section className="lp-section-story" id="tecnologia">
          <div className="lp-story-copy">
            {section.kicker ? <p className="lp-kicker">{section.kicker}</p> : null}
            {section.title ? <MoodTitle text={section.title} as="h2" className="mood-display" /> : null}
            {section.lead ? <p className="lp-mood-lead">{section.lead}</p> : null}
            {section.highlights?.length ? (
              <ol className="lp-story-highlights">
                {section.highlights.map((h, i) => (
                  <li key={h.title}>
                    <span className="lp-story-n" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="lp-story-h">{h.title}</p>
                      <p className="lp-story-b">{h.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
            <a href="#checkout" className="lp-text-cta">
              Quero esse conforto em casa →
            </a>
          </div>
          <div className="lp-story-layers">
            <MattressLayersBlock
              title="Por dentro do seu conforto"
              hint="Toque na camada para ver como ela melhora seu sono"
              layers={section.layers}
            />
          </div>
        </section>
      );
    case "quote":
      return (
        <section className="lp-quote-break">
          <span className="lp-quote-mark" aria-hidden>
            “
          </span>
          <blockquote>
            <MoodTitle text={section.text} as="p" className="mood-display mood-display--quote" />
            {section.attribution ? <footer>{section.attribution}</footer> : null}
          </blockquote>
        </section>
      );
    case "faq":
      return (
        <section className="lp-mood-faq" id="duvidas">
          {section.kicker ? <p className="lp-kicker">{section.kicker}</p> : null}
          {section.title ? <MoodTitle text={section.title} as="h2" className="mood-display" /> : null}
          {section.lead ? <p className="lp-mood-lead">{section.lead}</p> : null}
          <LpFaqAccordion title={undefined} items={section.items} />
        </section>
      );
    case "form":
      if (preview) {
        return (
          <section className="lp-mood-pad">
            <p className="type-caption-strong text-[var(--primary)]">Formulário Atrako</p>
          </section>
        );
      }
      return (
        <section className="lp-mood-pad lp-section-convert">
          <LpLeadForm
            title={section.title || "Deixe seus dados"}
            formSlug={formSlug}
            workspaceId={product.clienteId}
            productId={product.id}
            pageSlug={product.slug}
          />
        </section>
      );
    case "checkout":
      if (preview) {
        return (
          <section className="lp-mood-pad">
            <p className="type-caption-strong text-[var(--primary)]">Checkout Atrako</p>
          </section>
        );
      }
      {
        const sold = checkoutProduct ?? product;
        const physical = (sold.type || product.kind || "").toUpperCase() === "PHYSICAL";
        return (
          <section className="lp-section-offer" id="checkout">
            {(section.introTitle || section.introLead || section.introKicker) && (
              <div className="offer-intro">
                {section.introKicker ? <p className="lp-kicker">{section.introKicker}</p> : null}
                {section.introTitle ? (
                  <MoodTitle text={section.introTitle} as="h2" className="mood-display" />
                ) : null}
                {section.introLead ? <p className="lp-mood-lead">{section.introLead}</p> : null}
                {section.introStat ? (
                  <div className="offer-intro__stat">
                    <p className="offer-intro__stat-num">{section.introStat}</p>
                    {section.introStatLabel ? (
                      <p className="offer-intro__stat-label">{section.introStatLabel}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
            <Suspense fallback={<p className="type-caption">…</p>}>
              <CheckoutForm
                product={{
                  id: sold.id,
                  name: sold.name,
                  slug: sold.slug,
                  priceCents: sold.priceCents,
                  description: sold.description,
                  type: sold.type,
                  maxInstallments: product.maxInstallments,
                }}
                brandName={brandName}
                currency={currency}
                mpPublicKey={mpPublicKey}
                bump={bump}
                pageProductId={product.id}
                pageSlug={product.slug}
                variants={variants}
                pixDiscountPercent={page.pixDiscountPercent ?? 0}
                requireAddress={physical}
              />
            </Suspense>
          </section>
        );
      }
    case "cta":
      return (
        <section className="lp-final-cta">
          <div className="lp-final-cta__inner">
            {section.kicker ? <p className="lp-kicker lp-kicker--on-dark">{section.kicker}</p> : null}
            {section.title ? (
              <MoodTitle text={section.title} as="h2" className="mood-display mood-display--on-dark" />
            ) : null}
            {section.lead ? <p className="lp-mood-lead lp-mood-lead--on-dark">{section.lead}</p> : null}
            <a
              href={section.href || (page.goal === "sales" ? "#checkout" : "#form")}
              className="mood-btn-green"
            >
              {section.label} →
            </a>
            <ul className="lp-final-cta__perks">
              <li>15% OFF no Pix</li>
              <li>10x sem juros</li>
              <li>Frete grátis</li>
            </ul>
          </div>
        </section>
      );
    case "social_proof":
      return (
        <section className="lp-mood-pad">
          {section.quotes.map((q, i) => (
            <blockquote key={`${q.text}-${i}`} className="lp-quote-simple">
              <p>“{q.text}”</p>
              {q.author ? <footer>— {q.author}</footer> : null}
            </blockquote>
          ))}
        </section>
      );
    case "video":
      return null;
    default:
      return null;
  }
}

/** LP pública Mood — visual alinhado à preview de conversão. */
export function SalesPageView({
  page,
  product,
  brandName,
  currency = "BRL",
  mpPublicKey = null,
  formSlug,
  checkoutProduct = null,
  bump = null,
  preview,
  variants = [],
}: Props) {
  const galleryImages = useMemo(() => {
    const g = page.sections.find((s) => s.type === "gallery");
    return g && g.type === "gallery" ? g.images : undefined;
  }, [page.sections]);

  const pixPct = Math.min(100, Math.max(0, Math.round(page.pixDiscountPercent ?? 0)));
  const base = product.priceCents;
  const pixCents = pixPct > 0 ? Math.max(0, base - Math.round((base * pixPct) / 100)) : base;

  return (
    <div className="lp-page lp-page--mood">
      {page.sections.map((section) => (
        <div key={section.id} id={section.type === "form" ? "form" : undefined}>
          <SectionBlock
            section={section}
            product={product}
            brandName={brandName}
            currency={currency}
            mpPublicKey={mpPublicKey}
            formSlug={formSlug}
            page={page}
            preview={preview}
            checkoutProduct={checkoutProduct}
            bump={bump}
            variants={variants}
            galleryImages={section.type === "hero" ? galleryImages : undefined}
          />
        </div>
      ))}

      {page.goal === "sales" && !preview ? (
        <FloatingStickyBar
          className="lp-mood-sticky"
          label={
            <span className="lp-mood-sticky__price">
              <strong>{brl(pixCents, currency)}</strong>
              <small>à vista no Pix</small>
            </span>
          }
          ctaLabel="Comprar agora →"
          ctaHref="#checkout"
        />
      ) : null}
    </div>
  );
}
