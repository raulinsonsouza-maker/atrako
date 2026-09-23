"use client";

import { Suspense } from "react";
import { CheckoutForm } from "@/components/commerce/CheckoutForm";
import { LpLeadForm } from "@/components/commerce/LpLeadForm";
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
  /** Preview no editor — sem submit real */
  preview?: boolean;
};

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
}) {
  switch (section.type) {
    case "hero":
      return (
        <section className="lp-section lp-section-hero">
          <p className="type-fine-print uppercase tracking-wide text-[var(--ink-muted-48)]">
            {brandName}
          </p>
          <h1 className="mt-3 type-tagline text-[var(--ink)] sm:text-[28px] sm:leading-tight">
            {section.headline}
          </h1>
          {section.subheadline ? (
            <p className="mt-3 max-w-prose type-body text-[var(--ink-muted-80)]">
              {section.subheadline}
            </p>
          ) : null}
          {section.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={section.mediaUrl}
              alt=""
              className="mt-6 max-h-72 w-full max-w-lg rounded-[var(--radius-lg)] object-cover shadow-product"
            />
          ) : null}
        </section>
      );
    case "benefits":
      return (
        <section className="lp-section">
          <h2 className="type-caption-strong text-[var(--ink)]">O que você leva</h2>
          <ul className="mt-4 space-y-3">
            {section.items.map((item, i) => (
              <li
                key={`${i}-${item}`}
                className="flex gap-3 type-body text-[var(--ink-muted-80)]"
              >
                <span className="text-[var(--primary)]" aria-hidden>
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "social_proof":
      return (
        <section className="lp-section">
          <h2 className="type-caption-strong text-[var(--ink)]">Quem já usou</h2>
          <div className="mt-4 space-y-3">
            {section.quotes.map((q, i) => (
              <blockquote
                key={`${q.text}-${i}`}
                className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] p-4"
              >
                <p className="type-caption text-[var(--ink)]">“{q.text}”</p>
                {q.author ? (
                  <footer className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
                    — {q.author}
                  </footer>
                ) : null}
              </blockquote>
            ))}
          </div>
        </section>
      );
    case "faq":
      return (
        <section className="lp-section">
          <h2 className="type-caption-strong text-[var(--ink)]">Perguntas frequentes</h2>
          <dl className="mt-4 space-y-4">
            {section.items.map((item, i) => (
              <div key={`${i}-${item.q}`}>
                <dt className="type-caption-strong text-[var(--ink)]">{item.q}</dt>
                <dd className="mt-1 type-caption text-[var(--ink-muted-80)]">{item.a}</dd>
              </div>
            ))}
          </dl>
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
              <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                {(product.priceCents / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency,
                })}{" "}
                · Mercado Pago
              </p>
            </div>
          </section>
        );
      }
      return (
        <section className="lp-section lp-section-convert">
          <Suspense fallback={<p className="type-caption text-[var(--ink-muted-48)]">…</p>}>
            <CheckoutForm
              product={{
                id: (checkoutProduct ?? product).id,
                name: (checkoutProduct ?? product).name,
                slug: (checkoutProduct ?? product).slug,
                priceCents: (checkoutProduct ?? product).priceCents,
                description: (checkoutProduct ?? product).description,
                type: (checkoutProduct ?? product).type,
              }}
              brandName={brandName}
              currency={currency}
              mpPublicKey={mpPublicKey}
              bump={bump}
              pageProductId={product.id}
              pageSlug={product.slug}
            />
          </Suspense>
          {page.deliverable ? (
            <p className="mt-3 text-center type-fine-print text-[var(--ink-muted-48)]">
              Após o pagamento: {page.deliverable.label}
            </p>
          ) : null}
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
}: Props) {
  return (
    <div className="lp-page">
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
          />
        </div>
      ))}
    </div>
  );
}
