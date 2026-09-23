"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { OptionChip } from "@/components/ui/option-chip";
import { FloatingStickyBar } from "@/components/ui/floating-sticky-bar";
import { collectClientAttribution } from "@/lib/criar/lp-attribution";

type Props = {
  product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    description: string | null;
    type?: string;
  };
  brandName: string;
  currency: string;
  mpPublicKey: string | null;
  bump?: {
    id: string;
    name: string;
    priceCents: number;
    discountPercent: number;
    headline: string | null;
  } | null;
  parentOrderId?: string;
  /** LP que embute este checkout (pode diferir do product.id). */
  pageProductId?: string;
  pageSlug?: string;
};

function brl(cents: number, currency: string) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export function CheckoutForm({
  product,
  brandName,
  currency,
  mpPublicKey,
  bump,
  parentOrderId,
  pageProductId,
  pageSlug,
}: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [terms, setTerms] = useState(false);
  const [withBump, setWithBump] = useState(false);
  const [payType, setPayType] = useState<"pix" | "credit_card">("pix");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLabel = useMemo(() => {
    let cents = product.priceCents;
    if (withBump && bump) {
      cents += Math.round(bump.priceCents * (1 - bump.discountPercent / 100));
    }
    return brl(cents, currency);
  }, [product.priceCents, withBump, bump, currency]);

  const backHref = pageSlug
    ? `/p/${pageSlug}`
    : `/p/${product.slug}`;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payment =
        payType === "pix"
          ? { type: "pix" as const }
          : {
              type: "credit_card" as const,
              token: process.env.NODE_ENV === "production" ? "" : "demo",
              installments: 1,
              paymentMethodId: "visa",
            };

      if (payType === "credit_card" && process.env.NODE_ENV === "production" && !mpPublicKey) {
        setError("Pagamento com cartão indisponível. Conecte o Mercado Pago em Configurações.");
        setLoading(false);
        return;
      }

      const clientAttr = collectClientAttribution({
        productId: product.id,
        pageSlug: pageSlug || product.slug,
      });

      const res = await fetch("/api/atrako/commerce/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          bumpProductId: withBump && bump ? bump.id : undefined,
          parentOrderId: parentOrderId || search.get("parentOrderId") || undefined,
          email,
          name,
          cpf,
          phone,
          couponCode: couponCode || undefined,
          termsAccepted: terms,
          payment,
          pageProductId: pageProductId || undefined,
          pageSlug: pageSlug || undefined,
          checkoutProductId: product.id,
          productType: product.type || undefined,
          ...clientAttr,
          attribution: {
            utmSource: clientAttr.utm_source || search.get("utm_source") || undefined,
            utmMedium: clientAttr.utm_medium || search.get("utm_medium") || undefined,
            utmCampaign: clientAttr.utm_campaign || search.get("utm_campaign") || undefined,
            utmContent: clientAttr.utm_content || search.get("utm_content") || undefined,
            utmTerm: clientAttr.utm_term || search.get("utm_term") || undefined,
            pageSlug: pageSlug || undefined,
            pageProductId: pageProductId || undefined,
            pageUrl: clientAttr.pageUrl,
            checkoutProductId: product.id,
            productType: product.type || undefined,
            referrer: clientAttr.referrer,
            gclid: clientAttr.gclid,
            fbclid: clientAttr.fbclid,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível concluir a compra.");
      if (data.redirectTo) router.push(data.redirectTo);
      else router.push(`/obrigado?orderId=${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a compra. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form id="checkout-form" onSubmit={submit} className="utility-card mb-24 space-y-4">
        <div>
          <p className="type-caption-strong text-[var(--ink-muted-48)]">{brandName}</p>
          <h1 className="type-display-lg text-[var(--ink)]">{product.name}</h1>
          <p className="mt-1 type-body-strong text-[var(--ink)]">{totalLabel}</p>
          {!mpPublicKey ? (
            <p className="mt-2 type-caption text-amber-800">
              Mercado Pago não conectado — o pagamento pode não ser processado.{" "}
              <Link href="/config/conexoes" className="text-[var(--primary)] underline">
                Configurações
              </Link>
            </p>
          ) : null}
        </div>

        <input
          className="h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-[var(--primary-focus)]"
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-[var(--primary-focus)]"
          placeholder="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-[var(--primary-focus)]"
          placeholder="CPF"
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          required
        />
        <input
          className="h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-[var(--primary-focus)]"
          placeholder="Telefone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-[var(--primary-focus)]"
          placeholder="Cupom (opcional)"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
        />

        {bump ? (
          <label className="flex items-start gap-2 rounded-lg border border-[var(--hairline)] p-3 type-body">
            <input
              type="checkbox"
              checked={withBump}
              onChange={(e) => setWithBump(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="type-body-strong">{bump.headline || bump.name}</span>
              <br />
              <span className="type-caption text-[var(--ink-muted-48)]">
                +{brl(Math.round(bump.priceCents * (1 - bump.discountPercent / 100)), currency)}
                {bump.discountPercent ? ` (−${bump.discountPercent}%)` : ""}
              </span>
            </span>
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <OptionChip selected={payType === "pix"} onClick={() => setPayType("pix")}>
            PIX
          </OptionChip>
          <OptionChip selected={payType === "credit_card"} onClick={() => setPayType("credit_card")}>
            Cartão
          </OptionChip>
        </div>

        <label className="flex items-center gap-2 type-caption-strong text-[var(--ink-muted-80)]">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            required
          />
          Aceito os termos de compra
        </label>

        {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}

        <Button type="submit" variant="primary" disabled={loading} className="hidden w-full md:inline-flex">
          {loading ? "Processando…" : "Finalizar compra"}
        </Button>

        <div className="flex justify-center">
          <BackLink href={backHref}>Oferta</BackLink>
        </div>
      </form>

      <FloatingStickyBar
        className="md:hidden"
        label={totalLabel}
        ctaLabel={loading ? "Processando…" : "Finalizar compra"}
        ctaDisabled={loading}
        ctaType="submit"
        onCta={() => {
          const form = document.getElementById("checkout-form") as HTMLFormElement | null;
          form?.requestSubmit();
        }}
      />
    </>
  );
}
