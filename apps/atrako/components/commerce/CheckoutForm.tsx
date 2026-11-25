"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { OptionChip } from "@/components/ui/option-chip";
import { PillSelect } from "@/components/ui/pill-select";
import { FloatingStickyBar } from "@/components/ui/floating-sticky-bar";
import { collectClientAttribution } from "@/lib/criar/lp-attribution";
import { newEventId } from "@/lib/criar/form-tracking";

export type CheckoutVariantOption = {
  id: string;
  label: string;
  priceCents: number;
};

type InstallmentOption = {
  installments: number;
  installmentAmountCents: number;
  totalAmountCents: number;
  label: string;
};

type MpSdk = {
  createCardToken: (card: Record<string, string>) => Promise<{ id: string }>;
};

type Props = {
  product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    description: string | null;
    type?: string;
    maxInstallments?: number | null;
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
  pageProductId?: string;
  pageSlug?: string;
  previewToken?: string | null;
  variants?: CheckoutVariantOption[];
  pixDiscountPercent?: number;
  requireAddress?: boolean;
};

function brl(cents: number, currency: string) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function maskCard(v: string) {
  return digits(v)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function maskExpiry(v: string) {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function loadMercadoPago(publicKey: string) {
  const w = window as Window & {
    MercadoPago?: new (key: string, opts?: Record<string, string>) => MpSdk;
  };
  const ready = () => {
    if (!w.MercadoPago) throw new Error("Não foi possível abrir o cartão.");
    return new w.MercadoPago(publicKey, { locale: "pt-BR" });
  };
  if (w.MercadoPago) return Promise.resolve(ready());
  return new Promise<MpSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = () => {
      try {
        resolve(ready());
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = () => reject(new Error("Falha ao carregar Mercado Pago"));
    document.head.appendChild(script);
  });
}

function trackGa4(event: string, params: Record<string, unknown>) {
  const w = window as Window & { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === "function") w.gtag("event", event, params);
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
  previewToken,
  variants = [],
  pixDiscountPercent = 0,
  requireAddress = false,
}: Props) {
  const router = useRouter();
  const [testApproved, setTestApproved] = useState(false);
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
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [installments, setInstallments] = useState(1);
  const [paymentMethodId, setPaymentMethodId] = useState("visa");
  const [installmentOptions, setInstallmentOptions] = useState<InstallmentOption[]>([]);

  const selectedVariant = variants.find((v) => v.id === variantId) ?? null;
  const unitCents = selectedVariant?.priceCents ?? product.priceCents;
  const maxInstallments = Math.min(
    Math.max(1, product.maxInstallments && product.maxInstallments > 0 ? product.maxInstallments : 10),
    12,
  );
  const pixPct = Math.min(100, Math.max(0, Math.round(pixDiscountPercent)));

  const bumpCents =
    withBump && bump ? Math.round(bump.priceCents * (1 - bump.discountPercent / 100)) : 0;
  const cardTotalCents = unitCents + bumpCents;
  const pixDiscountCents = pixPct > 0 ? Math.round((cardTotalCents * pixPct) / 100) : 0;
  const pixTotalCents = Math.max(0, cardTotalCents - pixDiscountCents);
  const displayCents = payType === "pix" ? pixTotalCents : cardTotalCents;
  const totalLabel = brl(displayCents, currency);

  const backHref = pageSlug ? `/p/${pageSlug}` : `/p/${product.slug}`;

  useEffect(() => {
    if (!variants.length) return;
    if (!variantId || !variants.some((v) => v.id === variantId)) {
      setVariantId(variants[0].id);
    }
  }, [variants, variantId]);

  useEffect(() => {
    trackGa4("begin_checkout", {
      currency,
      value: displayCents / 100,
      items: [{ item_id: product.id, item_name: product.name, price: unitCents / 100 }],
    });
    // só na montagem / mudança de SKU base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, variantId]);

  const binKey = digits(cardNumber).slice(0, 6);
  useEffect(() => {
    if (payType !== "credit_card" || binKey.length < 6 || cardTotalCents <= 0) return;
    let cancelled = false;
    const amount = (cardTotalCents / 100).toFixed(2);
    fetch(
      `/api/atrako/commerce/checkout/installments?productId=${encodeURIComponent(product.id)}&bin=${encodeURIComponent(binKey)}&amount=${encodeURIComponent(amount)}`,
    )
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          paymentMethodId?: string;
          options?: InstallmentOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Sem parcelas para este cartão.");
        if (cancelled) return;
        if (body.paymentMethodId) setPaymentMethodId(body.paymentMethodId);
        const opts = (body.options ?? []).filter((o) => o.installments <= maxInstallments);
        setInstallmentOptions(opts);
        if (opts.length) {
          const preferred = opts.find((o) => o.installments === maxInstallments) ?? opts[opts.length - 1];
          setInstallments(preferred.installments);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInstallmentOptions([]);
          setInstallments(1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [payType, binKey, cardTotalCents, product.id, maxInstallments]);

  const installmentSelectOptions = useMemo(() => {
    if (installmentOptions.length) {
      return installmentOptions.map((o) => ({
        value: String(o.installments),
        label:
          o.installments === 1
            ? `À vista · ${brl(o.installmentAmountCents, currency)}`
            : `${o.installments}x de ${brl(o.installmentAmountCents, currency)} sem juros`,
      }));
    }
    return Array.from({ length: maxInstallments }, (_, i) => {
      const n = i + 1;
      const parcela = Math.round(cardTotalCents / n);
      return {
        value: String(n),
        label:
          n === 1
            ? `À vista · ${brl(cardTotalCents, currency)}`
            : `${n}x de ${brl(parcela, currency)} sem juros`,
      };
    });
  }, [installmentOptions, maxInstallments, cardTotalCents, currency]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (variants.length && !variantId) {
      setError("Escolha a medida do colchão.");
      return;
    }
    if (requireAddress) {
      if (digits(cep).length !== 8 || !street.trim() || !number.trim() || !city.trim() || !stateUf.trim()) {
        setError("Preencha o endereço completo com CEP válido.");
        return;
      }
    }
    if (previewToken) {
      if (
        !name.trim() ||
        !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim()) ||
        cpf.replace(/\D/g, "").length !== 11 ||
        !terms
      ) {
        setError("Preencha nome, e-mail válido, CPF com 11 dígitos e aceite os termos.");
        return;
      }
      setTestApproved(true);
      return;
    }
    setLoading(true);
    try {
      let payment:
        | { type: "pix" }
        | {
            type: "credit_card";
            token: string;
            installments: number;
            paymentMethodId: string;
          };

      if (payType === "pix") {
        payment = { type: "pix" };
      } else {
        if (!mpPublicKey) {
          setError("Pagamento com cartão indisponível. Conecte o Mercado Pago em Configurações.");
          setLoading(false);
          return;
        }
        const exp = digits(cardExpiry);
        if (digits(cardNumber).length < 13 || !cardName.trim() || exp.length < 4 || digits(cardCvv).length < 3) {
          setError("Preencha os dados do cartão.");
          setLoading(false);
          return;
        }
        const mp = await loadMercadoPago(mpPublicKey);
        const token = await mp.createCardToken({
          cardNumber: digits(cardNumber),
          cardholderName: cardName,
          cardExpirationMonth: exp.slice(0, 2),
          cardExpirationYear: `20${exp.slice(2, 4)}`,
          securityCode: digits(cardCvv),
          identificationType: "CPF",
          identificationNumber: digits(cpf),
        });
        payment = {
          type: "credit_card",
          token: token.id,
          installments: Number(installments) || 1,
          paymentMethodId,
        };
      }

      const eventId = newEventId();
      const clientAttr = collectClientAttribution({
        productId: product.id,
        pageSlug: pageSlug || product.slug,
      });

      const res = await fetch("/api/atrako/commerce/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantId: variantId || undefined,
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
          shippingAddress: requireAddress
            ? {
                street: street.trim(),
                number: number.trim(),
                complement: complement.trim() || undefined,
                city: city.trim(),
                state: stateUf.trim().toUpperCase().slice(0, 2),
                cep: digits(cep),
              }
            : undefined,
          fulfillment: requireAddress ? "SHIP" : undefined,
          ...clientAttr,
          attribution: {
            eventId,
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

      trackGa4("purchase", {
        transaction_id: data.orderId,
        currency,
        value: (typeof data.totalCents === "number" ? data.totalCents : displayCents) / 100,
        items: [{ item_id: product.id, item_name: product.name, price: unitCents / 100 }],
      });

      if (data.redirectTo) router.push(data.redirectTo);
      else router.push(`/obrigado?orderId=${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a compra. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (testApproved) {
    return (
      <div className="utility-card space-y-2 text-center">
        <p className="type-caption-strong text-[var(--ink)]">Compra de teste aprovada</p>
        <p className="type-body-strong text-[var(--ink)]">{totalLabel}</p>
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          Modo teste: nenhum pedido foi criado e nada foi cobrado. Pagamento via{" "}
          {payType === "pix" ? "Pix" : "cartão"}.
        </p>
      </div>
    );
  }

  const inputClass =
    "h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-[var(--primary-focus)]";

  return (
    <>
      <form id="checkout-form" onSubmit={submit} className="utility-card mb-24 space-y-4">
        {previewToken ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">Modo teste — o pagamento é simulado.</p>
        ) : null}
        <div>
          <p className="type-caption-strong text-[var(--ink-muted-48)]">{brandName}</p>
          <h1 className="type-tagline text-[var(--ink)]">{product.name}</h1>
          <p className="mt-1 type-body-strong text-[var(--ink)]">{totalLabel}</p>
          {pixPct > 0 ? (
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              {payType === "pix"
                ? `${pixPct}% off no Pix · ou ${brl(cardTotalCents, currency)} em até ${maxInstallments}x`
                : `No Pix: ${brl(pixTotalCents, currency)} (−${pixPct}%) · cartão em até ${maxInstallments}x sem juros`}
            </p>
          ) : (
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              Pix à vista ou cartão em até {maxInstallments}x sem juros
            </p>
          )}
          {!mpPublicKey && !previewToken ? (
            <p className="mt-2 type-caption text-amber-800">
              Mercado Pago não conectado — o pagamento pode não ser processado.{" "}
              <Link href="/config/conexoes" className="text-[var(--primary)] underline">
                Configurações
              </Link>
            </p>
          ) : null}
        </div>

        {variants.length > 0 ? (
          <div>
            <p className="mb-2 type-caption-strong text-[var(--ink-muted-80)]">Medida</p>
            <PillSelect
              size="field"
              value={variantId}
              onChange={setVariantId}
              aria-label="Medida"
              options={variants.map((v) => ({
                value: v.id,
                label: `${v.label} · ${brl(v.priceCents, currency)}`,
              }))}
            />
          </div>
        ) : null}

        <input className={inputClass} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          className={inputClass}
          placeholder="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input className={inputClass} placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} required />
        <input
          className={inputClass}
          placeholder="Telefone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {requireAddress ? (
          <div className="space-y-3 border-t border-[var(--hairline)] pt-4">
            <p className="type-caption-strong text-[var(--ink)]">Entrega — frete grátis</p>
            <input
              className={inputClass}
              placeholder="CEP"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              required
            />
            <input
              className={inputClass}
              placeholder="Rua"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="Número"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
              />
              <input
                className={inputClass}
                placeholder="Complemento"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
              <input
                className={inputClass}
                placeholder="UF"
                value={stateUf}
                onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
                required
                maxLength={2}
              />
            </div>
          </div>
        ) : null}

        <input
          className={inputClass}
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
            PIX{pixPct > 0 ? ` (−${pixPct}%)` : ""}
          </OptionChip>
          <OptionChip selected={payType === "credit_card"} onClick={() => setPayType("credit_card")}>
            Cartão até {maxInstallments}x
          </OptionChip>
        </div>

        {payType === "credit_card" ? (
          <div className="space-y-3">
            <input
              className={inputClass}
              placeholder="Número do cartão"
              value={cardNumber}
              onChange={(e) => setCardNumber(maskCard(e.target.value))}
              inputMode="numeric"
              autoComplete="cc-number"
              required
            />
            <input
              className={inputClass}
              placeholder="Nome no cartão"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              autoComplete="cc-name"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="MM/AA"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                inputMode="numeric"
                autoComplete="cc-exp"
                required
              />
              <input
                className={inputClass}
                placeholder="CVV"
                value={cardCvv}
                onChange={(e) => setCardCvv(digits(e.target.value).slice(0, 4))}
                inputMode="numeric"
                autoComplete="cc-csc"
                required
              />
            </div>
            <PillSelect
              size="field"
              value={String(installments)}
              onChange={(v) => setInstallments(Number(v) || 1)}
              aria-label="Parcelas"
              options={installmentSelectOptions}
            />
          </div>
        ) : null}

        <label className="flex items-center gap-2 type-caption-strong text-[var(--ink-muted-80)]">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
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
