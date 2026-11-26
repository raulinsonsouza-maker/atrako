"use client";

import { Suspense, useMemo } from "react";
import { CheckoutForm, type CheckoutVariantOption } from "@/components/commerce/CheckoutForm";
import { LpFaqAccordion } from "@/components/commerce/LpFaqAccordion";
import { LpLeadForm } from "@/components/commerce/LpLeadForm";
import { MattressLayersBlock } from "@/components/commerce/MattressLayersBlock";
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
            {section.kicker ? (
              <p className="lp-kicker type-fine-print">{section.kicker}</p>
            ) : null}
            <h1 className="type-tagline text-[var(--ink)]">{section.headline}</h1>
            {section.subheadline ? (
              <p className="mt-3 type-body text-[var(--ink-muted-80)]">{section.subheadline}</p>
            ) : null}
            {section.checks?.length ? (
              <ul className="lp-mood-hero__checks">
                {section.checks.map((c) => (
                  <li key={c} className="type-fine-print text-[var(--ink-muted-80)]">
                    <span className="lp-check" aria-hidden>
                      ✓
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            ) : null}
            <a href="#checkout" className="lp-offer-strip__cta mt-4">
              {section.ctaLabel || "Quero dormir melhor"} →
            </a>
            <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">Compra segura</p>
          </div>
          {galleryImages?.length ? (
            <div className="lp-mood-hero__visual">
              <ProductGallery mode="hero" images={galleryImages} />
            </div>
          ) : section.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={section.mediaUrl}
              alt=""
              className="mt-6 w-full rounded-[var(--radius-lg)] object-cover shadow-product"
            />
          ) : null}
        </section>
      );
    case "gallery":
      // Rendered inside hero when present after hero in page order
      return null;
    case "trust":
      return (
        <section className="lp-trust-bar" aria-label="Vantagens">
          {section.items.map((item) => (
            <div key={item.title} className="lp-trust-bar__item">
              <p className="type-caption-strong text-[var(--ink)]">{item.title}</p>
              <p className="type-fine-print text-[var(--ink-muted-48)]">{item.body}</p>
            </div>
          ))}
        </section>
      );
    case "benefits":
      return (
        <section className="lp-section lp-section-benefits" id="beneficios">
          {section.kicker ? <p className="lp-kicker type-fine-print text-center">{section.kicker}</p> : null}
          <h2 className="type-tagline text-center text-[var(--ink)]">
            {section.title || "Benefícios"}
          </h2>
          {section.lead ? (
            <p className="mt-2 text-center type-body text-[var(--ink-muted-80)]">{section.lead}</p>
          ) : null}
          <div className="lp-benefit-grid-lg">
            {section.items.map(normalizeBenefit).map((card, i) => (
              <article key={`${i}-${card.title}`} className="lp-benefit-tile-lg">
                {card.icon ? (
                  <span className="lp-benefit-num type-fine-print" aria-hidden>
                    {card.icon}
                  </span>
                ) : null}
                <h3 className="type-caption-strong text-[var(--ink)]">{card.title}</h3>
                {card.body ? <p className="type-fine-print text-[var(--ink-muted-80)]">{card.body}</p> : null}
              </article>
            ))}
          </div>
        </section>
      );
    case "mattress_layers":
      return (
        <section className="lp-section lp-section-story" id="tecnologia">
          <div className="lp-story-copy">
            {section.kicker ? <p className="lp-kicker type-fine-print">{section.kicker}</p> : null}
            {section.title ? <h2 className="type-tagline text-[var(--ink)]">{section.title}</h2> : null}
            {section.lead ? (
              <p className="mt-3 type-body text-[var(--ink-muted-80)]">{section.lead}</p>
            ) : null}
            {section.highlights?.length ? (
              <ol className="lp-story-highlights">
                {section.highlights.map((h, i) => (
                  <li key={h.title}>
                    <span className="lp-benefit-num type-fine-print" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="type-caption-strong text-[var(--ink)]">{h.title}</p>
                      <p className="type-fine-print text-[var(--ink-muted-80)]">{h.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
            <a href="#checkout" className="lp-text-cta type-caption-strong">
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
          <blockquote>
            <p className="type-tagline text-[var(--ink)]">“{section.text}”</p>
            {section.attribution ? (
              <footer className="mt-4 type-fine-print text-[var(--ink-muted-48)]">
                {section.attribution}
              </footer>
            ) : null}
          </blockquote>
        </section>
      );
    case "faq":
      return (
        <section className="lp-section" id="duvidas">
          {section.kicker ? <p className="lp-kicker type-fine-print text-center">{section.kicker}</p> : null}
          {section.lead ? (
            <p className="mb-3 text-center type-body text-[var(--ink-muted-80)]">{section.lead}</p>
          ) : null}
          <LpFaqAccordion title={section.title} items={section.items} />
        </section>
      );
    case "form":
      if (preview) {
        return (
          <section className="lp-section">
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--primary)]/40 bg-[var(--canvas)] p-5 text-center">
              <p className="type-caption-strong text-[var(--primary)]">Formulário Atrako</p>
            </div>
          </section>
        );
      }
      return (
        <section className="lp-section lp-section-convert">
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
          <section className="lp-section">
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--primary)]/40 p-5 text-center">
              <p className="type-caption-strong text-[var(--primary)]">Checkout Atrako</p>
            </div>
          </section>
        );
      }
      {
        const sold = checkoutProduct ?? product;
        const physical = (sold.type || product.kind || "").toUpperCase() === "PHYSICAL";
        return (
          <section className="lp-section lp-section-offer" id="checkout">
            {(section.introTitle || section.introLead) && (
              <div className="offer-intro">
                {section.introTitle ? (
                  <h2 className="type-tagline text-[var(--ink)]">{section.introTitle}</h2>
                ) : null}
                {section.introLead ? (
                  <p className="mt-3 type-body text-[var(--ink-muted-80)]">{section.introLead}</p>
                ) : null}
                {section.introStat ? (
                  <div className="offer-intro__stat">
                    <p className="offer-intro__stat-num">{section.introStat}</p>
                    {section.introStatLabel ? (
                      <p className="type-fine-print text-[var(--ink-muted-48)]">{section.introStatLabel}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
            <Suspense fallback={<p className="type-caption text-[var(--ink-muted-48)]">…</p>}>
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
          {section.kicker ? <p className="lp-kicker type-fine-print">{section.kicker}</p> : null}
          {section.title ? <h2 className="type-tagline text-[var(--ink)]">{section.title}</h2> : null}
          {section.lead ? (
            <p className="mt-3 type-body text-[var(--ink-muted-80)]">{section.lead}</p>
          ) : null}
          <a
            href={section.href || (page.goal === "sales" ? "#checkout" : "#form")}
            className="lp-offer-strip__cta mt-5"
          >
            {section.label} →
          </a>
        </section>
      );
    case "social_proof":
      return (
        <section className="lp-section">
          <div className="space-y-3">
            {section.quotes.map((q, i) => (
              <blockquote
                key={`${q.text}-${i}`}
                className="rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4"
              >
                <p className="type-caption text-[var(--ink)]">“{q.text}”</p>
                {q.author ? (
                  <footer className="mt-2 type-fine-print text-[var(--ink-muted-48)]">— {q.author}</footer>
                ) : null}
              </blockquote>
            ))}
          </div>
        </section>
      );
    case "video":
      return null;
    default:
      return null;
  }
}

/** LP pública / preview — seções DS + Form/Checkout Atrako. */
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
        <div
          key={section.id}
          id={
            section.type === "checkout"
              ? undefined
              : section.type === "form"
                ? "form"
                : undefined
          }
        >
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
            <span>
              <strong className="type-caption-strong">{brl(pixCents, currency)}</strong>
              <span className="type-fine-print text-[var(--ink-muted-48)]"> à vista no Pix</span>
            </span>
          }
          ctaLabel="Comprar agora →"
          ctaHref="#checkout"
        />
      ) : null}
    </div>
  );
}
