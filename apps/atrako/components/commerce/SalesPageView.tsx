"use client";

import { Suspense } from "react";
import { CheckoutForm, type CheckoutVariantOption } from "@/components/commerce/CheckoutForm";
import { LpFaqAccordion } from "@/components/commerce/LpFaqAccordion";
import { LpLeadForm } from "@/components/commerce/LpLeadForm";
import { MattressLayersBlock } from "@/components/commerce/MattressLayersBlock";
import { ProductGallery } from "@/components/commerce/ProductGallery";
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

function OfferStrip({
  product,
  page,
  currency,
}: {
  product: SalesPageProduct;
  page: LpSalesPageV1;
  currency: string;
}) {
  const pixPct = Math.min(100, Math.max(0, Math.round(page.pixDiscountPercent ?? 0)));
  const base = product.priceCents;
  const pixCents = pixPct > 0 ? Math.max(0, base - Math.round((base * pixPct) / 100)) : base;
  const maxInst = product.maxInstallments && product.maxInstallments > 0 ? product.maxInstallments : 10;
  return (
    <div className="lp-offer-strip">
      <div className="lp-offer-strip__price">
        <p className="lp-offer-strip__pix type-body-strong">{brl(pixCents, currency)}</p>
        <p className="type-fine-print text-[var(--ink-muted-80)]">
          no Pix{pixPct > 0 ? ` · −${pixPct}%` : ""}
        </p>
      </div>
      <div className="lp-offer-strip__chips">
        <span className="lp-chip lp-chip--pix">Pix −{pixPct || 0}%</span>
        <span className="lp-chip">{maxInst}x sem juros</span>
        <span className="lp-chip">Frete grátis</span>
      </div>
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        ou {brl(base, currency)} no cartão
      </p>
      <a href="#checkout" className="lp-offer-strip__cta">
        Escolher medida e comprar
      </a>
    </div>
  );
}

function BenefitsVisual({
  title,
  lead,
  items,
}: {
  title?: string;
  lead?: string;
  items: Array<string | { title: string; body?: string; icon?: string }>;
}) {
  const cards = items.map(normalizeBenefit);
  return (
    <section className="lp-benefits-visual">
      <h2 className="type-caption-strong text-[var(--ink)]">{title || "Por que o Mood"}</h2>
      {lead ? <p className="mt-2 type-body text-[var(--ink-muted-80)]">{lead}</p> : null}
      <div className="lp-benefits-grid">
        {cards.map((card, i) => (
          <article key={`${i}-${card.title}`} className="lp-benefit-tile">
            <div className="lp-benefit-tile__icon" aria-hidden>
              {card.icon || "✦"}
            </div>
            <h3 className="type-caption-strong text-[var(--ink)]">{card.title}</h3>
            {card.body ? <p className="type-fine-print text-[var(--ink-muted-80)]">{card.body}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
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
}) {
  switch (section.type) {
    case "hero":
      return (
        <section className="lp-section lp-section-hero lp-section-hero--tight">
          <h1 className="type-tagline text-[var(--ink)]">{section.headline}</h1>
          {section.subheadline ? (
            <p className="mt-3 max-w-prose mx-auto type-body text-[var(--ink-muted-80)]">
              {section.subheadline}
            </p>
          ) : null}
        </section>
      );
    case "gallery":
      return (
        <section className="lp-section lp-section-gallery">
          <ProductGallery title={undefined} images={section.images} />
          {page.goal === "sales" ? <OfferStrip product={product} page={page} currency={currency} /> : null}
        </section>
      );
    case "video":
      return (
        <section className="lp-section lp-section-video">
          <div className="lp-video">
            {section.title ? (
              <h2 className="lp-video__title type-caption-strong text-[var(--ink)]">{section.title}</h2>
            ) : null}
            <div className="lp-video__frame">
              <video
                src={section.src}
                poster={section.poster}
                controls
                playsInline
                muted
                loop
                preload="metadata"
              />
            </div>
          </div>
        </section>
      );
    case "benefits":
      return (
        <section className="lp-section lp-section-benefits">
          <BenefitsVisual title={section.title} lead={section.lead} items={section.items} />
        </section>
      );
    case "social_proof":
      return (
        <section className="lp-section lp-section-trust">
          <div className="lp-trust-row">
            {section.quotes.map((q, i) => (
              <blockquote key={`${q.text}-${i}`} className="lp-trust-quote">
                <p className="type-caption text-[var(--ink)]">“{q.text}”</p>
                {q.author ? (
                  <footer className="mt-2 type-fine-print text-[var(--ink-muted-48)]">— {q.author}</footer>
                ) : null}
              </blockquote>
            ))}
          </div>
        </section>
      );
    case "faq":
      return (
        <section className="lp-section">
          <LpFaqAccordion title={section.title} items={section.items} />
        </section>
      );
    case "form":
      if (preview) {
        return (
          <section className="lp-section">
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--primary)]/40 bg-[var(--canvas)] p-5 text-center">
              <p className="type-caption-strong text-[var(--primary)]">Formulário Atrako</p>
              <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                {section.title || "Captura → CRM"}
              </p>
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
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--primary)]/40 bg-[var(--canvas)] p-5 text-center">
              <p className="type-caption-strong text-[var(--primary)]">Checkout Atrako</p>
            </div>
          </section>
        );
      }
      {
        const sold = checkoutProduct ?? product;
        const physical = (sold.type || product.kind || "").toUpperCase() === "PHYSICAL";
        return (
          <section className="lp-section lp-section-convert lp-section-checkout">
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
    case "mattress_layers":
      return (
        <section className="lp-section lp-section-layers">
          <MattressLayersBlock title={section.title} layers={section.layers} />
        </section>
      );
    case "cta":
      return (
        <section className="lp-section text-center">
          <a
            href={section.href || (page.goal === "sales" ? "#checkout" : "#form")}
            className="inline-flex items-center justify-center rounded-[var(--radius-xs)] bg-[var(--primary)] px-[22px] py-3 type-button-utility text-[var(--on-primary)] active:scale-95"
          >
            {section.label}
          </a>
        </section>
      );
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
  return (
    <div className="lp-page lp-page--alive">
      {page.sections.map((section) => (
        <div
          key={section.id}
          id={
            section.type === "checkout"
              ? "checkout"
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
          />
        </div>
      ))}
    </div>
  );
}
