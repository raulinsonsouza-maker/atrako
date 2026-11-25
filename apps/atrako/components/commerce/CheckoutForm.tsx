"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { OptionChip } from "@/components/ui/option-chip";
import { PillSelect } from "@/components/ui/pill-select";
import { FloatingStickyBar } from "@/components/ui/floating-sticky-bar";
import { Switch } from "@/components/ui/switch";
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

type Step = 1 | 2 | 3;

function brl(cents: number, currency: string) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function maskCpf(v: string) {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskPhone(v: string) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function maskCep(v: string) {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
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
  const [step, setStep] = useState<Step>(1);
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
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
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
  const savingsLabel =
    pixPct > 0 && payType === "pix" ? brl(cardTotalCents - pixTotalCents, currency) : null;

  const backHref = pageSlug ? `/p/${pageSlug}` : `/p/${product.slug}`;
  const paymentStep: Step = requireAddress ? 3 : 2;
  const visibleStep = step;

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

  useEffect(() => {
    const d = digits(cep);
    if (d.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    fetch(`https://viacep.com.br/ws/${d}/json/`)
      .then(async (res) => {
        const data = (await res.json()) as {
          erro?: boolean;
          logradouro?: string;
          bairro?: string;
          localidade?: string;
          uf?: string;
        };
        if (cancelled || data.erro) return;
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setStateUf(data.uf);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setCepLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cep]);

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

  function validateStep1(): string | null {
    if (variants.length && !variantId) return "Escolha a medida do colchão.";
    if (!name.trim()) return "Informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())) return "Informe um e-mail válido.";
    if (digits(cpf).length !== 11) return "Informe um CPF com 11 dígitos.";
    if (digits(phone).length < 10) return "Informe um WhatsApp válido.";
    return null;
  }

  function validateStep2(): string | null {
    if (!requireAddress) return null;
    if (digits(cep).length !== 8) return "Informe um CEP válido.";
    if (!street.trim() || !number.trim() || !city.trim() || stateUf.trim().length !== 2) {
      return "Preencha o endereço completo.";
    }
    return null;
  }

  function goNext() {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2 && requireAddress) {
      const err = validateStep2();
      if (err) {
        setError(err);
        return;
      }
      setStep(3);
    }
  }

  function goBack() {
    setError(null);
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const e1 = validateStep1();
    if (e1) {
      setError(e1);
      setStep(1);
      return;
    }
    if (requireAddress) {
      const e2 = validateStep2();
      if (e2) {
        setError(e2);
        setStep(2);
        return;
      }
    }
    if (!terms) {
      setError("Aceite os termos de compra.");
      setStep(paymentStep);
      return;
    }
    if (previewToken) {
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
                neighborhood: neighborhood.trim() || undefined,
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

  const stepLabels = requireAddress
    ? [
        { n: 1 as Step, label: "Dados" },
        { n: 2 as Step, label: "Entrega" },
        { n: 3 as Step, label: "Pagamento" },
      ]
    : [
        { n: 1 as Step, label: "Dados" },
        { n: 2 as Step, label: "Pagamento" },
      ];

  const onPaymentStep = visibleStep === paymentStep;

  return (
    <>
      <form
        id="checkout-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (onPaymentStep) void submit();
          else goNext();
        }}
        className={`utility-card space-y-4 ${onPaymentStep ? "mb-24" : "mb-6"}`}
      >
        {previewToken ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">Modo teste — o pagamento é simulado.</p>
        ) : null}

        <div>
          <p className="type-caption-strong text-[var(--ink-muted-48)]">{brandName}</p>
          <h1 className="type-tagline text-[var(--ink)]">{product.name}</h1>
          <p className="mt-1 type-body-strong text-[var(--ink)]">{brl(pixTotalCents, currency)} no Pix</p>
          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
            ou {brl(cardTotalCents, currency)} em até {maxInstallments}x sem juros
            {pixPct > 0 ? ` · economia de ${brl(pixDiscountCents, currency)} no Pix` : ""}
          </p>
          {!mpPublicKey && !previewToken ? (
            <p className="mt-2 type-caption text-amber-800">
              Mercado Pago não conectado — o pagamento pode não ser processado.{" "}
              <Link href="/config/conexoes" className="text-[var(--primary)] underline">
                Configurações
              </Link>
            </p>
          ) : null}
        </div>

        <div className="checkout-stepper" aria-label="Passos do checkout">
          {stepLabels.map((s) => (
            <div
              key={s.n}
              className={`checkout-stepper__item type-fine-print${
                visibleStep === s.n ? " is-on" : visibleStep > s.n ? " is-done" : ""
              }`}
            >
              {s.n}. {s.label}
            </div>
          ))}
        </div>

        {visibleStep === 1 ? (
          <div className="space-y-3">
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
            <input
              className={inputClass}
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            <input
              className={inputClass}
              placeholder="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <input
              className={inputClass}
              placeholder="CPF"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              inputMode="numeric"
              autoComplete="off"
              required
            />
            <input
              className={inputClass}
              placeholder="WhatsApp"
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </div>
        ) : null}

        {visibleStep === 2 && requireAddress ? (
          <div className="space-y-3">
            <p className="type-caption-strong text-[var(--ink)]">Entrega — frete grátis</p>
            <input
              className={inputClass}
              placeholder="CEP"
              value={cep}
              onChange={(e) => setCep(maskCep(e.target.value))}
              inputMode="numeric"
              autoComplete="postal-code"
              required
            />
            {cepLoading ? (
              <p className="type-fine-print text-[var(--ink-muted-48)]">Buscando endereço…</p>
            ) : null}
            <input
              className={inputClass}
              placeholder="Rua"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              autoComplete="address-line1"
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
            <input
              className={inputClass}
              placeholder="Bairro"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="Cidade"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
                required
              />
              <input
                className={inputClass}
                placeholder="UF"
                value={stateUf}
                onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
                autoComplete="address-level1"
                required
                maxLength={2}
              />
            </div>
          </div>
        ) : null}

        {onPaymentStep ? (
          <div className="space-y-4">
            <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] p-4">
              <p className="type-caption-strong text-[var(--ink)]">Resumo</p>
              <p className="mt-1 type-body text-[var(--ink-muted-80)]">
                {selectedVariant?.label || product.name}
              </p>
              <p className="mt-2 type-body-strong text-[var(--primary)]">
                Pix: {brl(pixTotalCents, currency)}
                {savingsLabel ? ` · você economiza ${savingsLabel}` : ""}
              </p>
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                Cartão: {brl(cardTotalCents, currency)} em até {maxInstallments}x
              </p>
              {requireAddress ? (
                <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">Frete grátis · Brasil</p>
              ) : null}
            </div>

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

            <div className="flex items-center justify-between gap-3">
              <span className="type-caption-strong text-[var(--ink-muted-80)]">Aceito os termos de compra</span>
              <Switch checked={terms} onChange={setTerms} aria-label="Aceito os termos de compra" />
            </div>
          </div>
        ) : null}

        {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {visibleStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="type-caption-strong text-[var(--primary)] active:scale-95"
            >
              Voltar
            </button>
          ) : (
            <BackLink href={backHref}>Oferta</BackLink>
          )}

          {!onPaymentStep ? (
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              Continuar
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={loading} className="hidden w-full md:inline-flex">
              {loading ? "Processando…" : `Finalizar · ${totalLabel}`}
            </Button>
          )}
        </div>
      </form>

      {onPaymentStep ? (
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
      ) : null}
    </>
  );
}
