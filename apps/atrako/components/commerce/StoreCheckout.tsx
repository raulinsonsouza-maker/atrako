"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import {
  clearStoreCart,
  readStoreCart,
  type StoreCartLineClient,
} from "@/lib/commerce/cart-client";
import { cn } from "@/lib/utils";

type Phase = "identity" | "shipping" | "pay" | "review" | "done";

type Quote = {
  subtotalCents: number;
  discountCents: number;
  shippingFeeCents: number;
  totalCents: number;
  shipping: { available: boolean; zoneName?: string | null; daysMin?: number | null; daysMax?: number | null };
};

type MpSdk = {
  createCardToken: (card: Record<string, string>) => Promise<{ id: string }>;
};

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function loadMercadoPago(publicKey: string) {
  const w = window as Window & { MercadoPago?: new (key: string) => MpSdk };
  const ready = () => {
    if (!w.MercadoPago) throw new Error("Não foi possível abrir o cartão.");
    return new w.MercadoPago(publicKey);
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
    document.body.appendChild(script);
  });
}

function requestIdKey(storeId: string) {
  return `store-charge:${storeId}`;
}

export function StoreCheckout({
  storeId,
  storeSlug,
  storeName,
  shipEnabled,
  pickupEnabled,
}: {
  storeId: string;
  storeSlug: string;
  storeName: string;
  shipEnabled: boolean;
  pickupEnabled: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("identity");
  const [lines, setLines] = useState<StoreCartLineClient[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [fulfillment, setFulfillment] = useState<"SHIP" | "PICKUP">(
    shipEnabled ? "SHIP" : "PICKUP",
  );
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"pix" | "card">("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [installments, setInstallments] = useState("1");
  const [paymentMethodId, setPaymentMethodId] = useState("visa");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneToken, setDoneToken] = useState<string | null>(null);

  useEffect(() => {
    setLines(readStoreCart(storeId));
  }, [storeId]);

  useEffect(() => {
    fetch(`/api/atrako/commerce/public/${storeSlug}/pay-config`)
      .then((r) => r.json())
      .then((d) => setPublicKey(d.publicKey ?? null))
      .catch(() => null);
  }, [storeSlug]);

  const itemsPayload = useMemo(
    () =>
      lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
      })),
    [lines],
  );

  async function refreshQuote() {
    setQuoteError(null);
    const r = await fetch(`/api/atrako/commerce/public/${storeSlug}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preview: true,
        items: itemsPayload,
        fulfillment,
        cep: fulfillment === "SHIP" ? cep : null,
        couponCode: couponCode || null,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      setQuote(null);
      setQuoteError(data.error || "Não foi possível calcular");
      return null;
    }
    setQuote(data);
    return data as Quote;
  }

  useEffect(() => {
    if (phase !== "shipping" && phase !== "pay" && phase !== "review") return;
    if (!itemsPayload.length) return;
    const t = setTimeout(() => {
      void refreshQuote();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fulfillment, cep, couponCode, itemsPayload]);

  async function placeOrder() {
    setBusy(true);
    setError(null);
    try {
      const q = quote ?? (await refreshQuote());
      if (!q) throw new Error(quoteError || "Cotação inválida");

      let payment: Record<string, unknown> = { type: "pix" };
      if (payMethod === "card") {
        if (!publicKey) throw new Error("Mercado Pago não configurado");
        const mp = await loadMercadoPago(publicKey);
        const exp = digits(cardExpiry);
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
          type: "card",
          token: token.id,
          paymentMethodId,
          installments: Number(installments) || 1,
        };
      }

      let clientRequestId = sessionStorage.getItem(requestIdKey(storeId));
      if (!clientRequestId) {
        clientRequestId = crypto.randomUUID();
        sessionStorage.setItem(requestIdKey(storeId), clientRequestId);
      }

      const r = await fetch(`/api/atrako/commerce/public/${storeSlug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsPayload,
          fulfillment,
          cep: fulfillment === "SHIP" ? cep : null,
          couponCode: couponCode || null,
          expectedTotalCents: q.totalCents,
          clientRequestId,
          email,
          name,
          phone,
          cpf,
          shippingAddress:
            fulfillment === "SHIP"
              ? { street, number, complement, city, state: stateUf, cep: digits(cep) }
              : null,
          payment,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Falha no pedido");

      clearStoreCart(storeId);
      sessionStorage.removeItem(requestIdKey(storeId));
      setDoneToken(data.order.publicToken);
      setPhase("done");
      if (data.order.publicToken) {
        router.push(`/loja/${storeSlug}/pedido/${data.order.publicToken}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!lines.length && phase !== "done") {
    return (
      <div className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-6">
        <p className="type-body">Carrinho vazio.</p>
        <a href={`/loja/${storeSlug}`} className={cn(buttonVariants({ variant: "primary" }), "mt-4 inline-flex")}>
          Voltar à loja
        </a>
      </div>
    );
  }

  const steps: { id: Phase; label: string }[] = [
    { id: "identity", label: "Você" },
    { id: "shipping", label: "Entrega" },
    { id: "pay", label: "Pagamento" },
    { id: "review", label: "Confirmar" },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <p className="type-fine-print text-[var(--ink-muted-48)]">{storeName}</p>
        <h1 className="type-tagline text-[var(--ink)]">Checkout</h1>
      </div>

      <ol className="flex flex-wrap gap-2">
        {steps.map((s, i) => {
          const idx = steps.findIndex((x) => x.id === phase);
          const done = phase === "done" || i < idx;
          const active = s.id === phase;
          return (
            <li
              key={s.id}
              className={`rounded-full px-3 py-1 type-fine-print ${
                active
                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                  : done
                    ? "bg-[var(--canvas)] text-[var(--ink)]"
                    : "text-[var(--ink-muted-48)]"
              }`}
            >
              {s.label}
            </li>
          );
        })}
      </ol>

      {phase === "identity" ? (
        <div className="space-y-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
          <input
            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
            placeholder="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
            placeholder="CPF"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />
          <button
            type="button"
            className={cn(buttonVariants({ variant: "primary" }), "w-full")}
            disabled={!name.trim() || !email.includes("@") || digits(cpf).length !== 11}
            onClick={() => setPhase("shipping")}
          >
            Continuar
          </button>
        </div>
      ) : null}

      {phase === "shipping" ? (
        <div className="space-y-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
          <PillSelect
            size="field"
            value={fulfillment}
            onChange={(v) => setFulfillment(v as "SHIP" | "PICKUP")}
            options={[
              ...(shipEnabled ? [{ value: "SHIP", label: "Receber em casa" }] : []),
              ...(pickupEnabled ? [{ value: "PICKUP", label: "Retirar na loja" }] : []),
            ]}
          />
          {fulfillment === "SHIP" ? (
            <>
              <input
                className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                placeholder="CEP"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
              />
              <input
                className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                placeholder="Rua"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                  placeholder="Número"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                />
                <input
                  className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                  placeholder="Complemento"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                  placeholder="Cidade"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <input
                  className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                  placeholder="UF"
                  value={stateUf}
                  onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
                />
              </div>
            </>
          ) : null}
          <input
            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body uppercase"
            placeholder="Cupom (opcional)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
          />
          {quoteError ? <p className="type-caption text-red-600">{quoteError}</p> : null}
          {quote ? (
            <p className="type-caption text-[var(--ink-muted-80)]">
              Frete {brl(quote.shippingFeeCents)}
              {quote.shipping.zoneName ? ` · ${quote.shipping.zoneName}` : ""}
              {quote.shipping.daysMin != null
                ? ` · ${quote.shipping.daysMin}–${quote.shipping.daysMax} dias`
                : ""}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
              onClick={() => setPhase("identity")}
            >
              Voltar
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "primary" }), "flex-1")}
              disabled={!quote || Boolean(quoteError)}
              onClick={() => setPhase("pay")}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {phase === "pay" ? (
        <div className="space-y-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
          <PillSelect
            size="field"
            value={payMethod}
            onChange={(v) => setPayMethod(v as "pix" | "card")}
            options={[
              { value: "pix", label: "Pix" },
              { value: "card", label: "Cartão" },
            ]}
          />
          {payMethod === "card" ? (
            <>
              <input
                className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                placeholder="Número do cartão"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
              />
              <input
                className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                placeholder="Nome no cartão"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                />
                <input
                  className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                  placeholder="CVV"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                />
              </div>
              <input
                className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                placeholder="Bandeira (visa, master…)"
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
              />
              <input
                className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                placeholder="Parcelas"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
              />
            </>
          ) : (
            <p className="type-caption text-[var(--ink-muted-48)]">
              Após confirmar, você verá o QR Code Pix.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
              onClick={() => setPhase("shipping")}
            >
              Voltar
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "primary" }), "flex-1")}
              onClick={() => setPhase("review")}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {phase === "review" ? (
        <div className="space-y-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
          <ul className="space-y-1">
            {lines.map((l) => (
              <li key={`${l.productId}-${l.variantId}`} className="flex justify-between type-caption">
                <span>
                  {l.quantity}× {l.name}
                  {l.optionsLabel ? ` (${l.optionsLabel})` : ""}
                </span>
                <span className="tabular-nums">{brl(l.priceCents * l.quantity)}</span>
              </li>
            ))}
          </ul>
          {quote ? (
            <div className="space-y-1 border-t border-[var(--hairline)] pt-3 type-caption">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums">{brl(quote.subtotalCents)}</span>
              </div>
              {quote.discountCents > 0 ? (
                <div className="flex justify-between">
                  <span>Desconto</span>
                  <span className="tabular-nums">−{brl(quote.discountCents)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span>Frete</span>
                <span className="tabular-nums">{brl(quote.shippingFeeCents)}</span>
              </div>
              <div className="flex justify-between type-body-strong">
                <span>Total</span>
                <span className="tabular-nums">{brl(quote.totalCents)}</span>
              </div>
            </div>
          ) : null}
          {error ? <p className="type-caption text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
              onClick={() => setPhase("pay")}
            >
              Voltar
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "primary" }), "flex-1")}
              disabled={busy || !quote}
              onClick={() => void placeOrder()}
            >
              {busy ? "Processando…" : `Pagar ${quote ? brl(quote.totalCents) : ""}`}
            </button>
          </div>
        </div>
      ) : null}

      {phase === "done" && doneToken ? (
        <p className="type-body">Pedido criado. Redirecionando…</p>
      ) : null}
    </div>
  );
}
