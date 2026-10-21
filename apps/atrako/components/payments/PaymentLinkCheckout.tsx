"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { Button, OptionChip, SegmentedControl, TextField } from "@/components/ui";
import type { PublicPaymentLink } from "@/lib/crm/payment-links";

type Installment = {
  installments: number;
  installmentAmountCents: number;
  totalAmountCents: number;
  label: string;
};

type MpSdk = { createCardToken: (card: Record<string, string>) => Promise<{ id: string }> };

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const digits = (v: string) => v.replace(/\D/g, "");

function maskCpf(v: string) {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function maskCard(v: string) {
  return digits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function maskExpiry(v: string) {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function loadMercadoPago(publicKey: string) {
  const w = window as Window & { MercadoPago?: new (key: string, opts?: Record<string, string>) => MpSdk };
  const ready = () => {
    if (!w.MercadoPago) throw new Error("Não foi possível carregar o pagamento com cartão.");
    return new w.MercadoPago(publicKey, { locale: "pt-BR" });
  };
  if (w.MercadoPago) return Promise.resolve(ready());
  return new Promise<MpSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.onload = () => {
      try {
        resolve(ready());
      } catch (err) {
        reject(err);
      }
    };
    script.onerror = () => reject(new Error("Não foi possível carregar o pagamento com cartão."));
    document.head.appendChild(script);
  });
}

export function PaymentLinkCheckout({ initial }: { initial: PublicPaymentLink }) {
  const link = initial;
  const [status, setStatus] = useState(link.status);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [name, setName] = useState(link.payer.name);
  const [email, setEmail] = useState(link.payer.email);
  const [cpf, setCpf] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [brand, setBrand] = useState("");
  const [options, setOptions] = useState<Installment[]>([]);
  const [installments, setInstallments] = useState(1);
  const [pix, setPix] = useState<{ code: string | null; image: string | null }>({
    code: link.pixQrCode,
    image: link.pixQrCodeBase64,
  });
  const [verificationUrl, setVerificationUrl] = useState("");
  const [waiting, setWaiting] = useState(Boolean(link.pixQrCode));
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const bin = digits(cardNumber).slice(0, 8);
  const binKey = bin.slice(0, 6);
  useEffect(() => {
    if (method !== "card" || binKey.length < 6) return;
    let cancelled = false;
    fetch(`/api/pagar/${encodeURIComponent(link.token)}/installments?bin=${binKey}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          paymentMethodId?: string;
          options?: Installment[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Sem parcelas para este cartão.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        const list = body.options ?? [];
        setBrand(body.paymentMethodId || "");
        setOptions(list);
        setInstallments((current) => (list.some((o) => o.installments === current) ? current : list[list.length - 1]?.installments ?? 1));
        setError("");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setBrand("");
        setOptions([]);
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [binKey, method, link.token]);

  useEffect(() => {
    if (!waiting || status !== "PENDING") return;
    const id = window.setInterval(() => {
      fetch(`/api/pagar/${encodeURIComponent(link.token)}/status`)
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { status?: PublicPaymentLink["status"] } | null) => {
          if (body?.status && body.status !== "PENDING") setStatus(body.status);
        })
        .catch(() => null);
    }, 5000);
    return () => window.clearInterval(id);
  }, [waiting, status, link.token]);

  async function submit() {
    setError("");
    if (name.trim().split(/\s+/).length < 2) return setError("Informe nome e sobrenome.");
    if (!email.includes("@")) return setError("Informe um e-mail válido.");
    if (digits(cpf).length !== 11) return setError("Informe um CPF válido.");
    let cardToken = "";
    if (method === "card") {
      if (digits(cardNumber).length < 13 || cardName.trim().length < 3 || digits(cardExpiry).length !== 4 || digits(cardCvv).length < 3) {
        return setError("Preencha os dados do cartão.");
      }
      if (!brand || !options.length) return setError("Aguarde as parcelas deste cartão.");
    }
    setPending(true);
    try {
      if (method === "card") {
        if (!link.mp.publicKey) throw new Error("Pagamento com cartão indisponível.");
        const [month, year] = cardExpiry.split("/");
        const mp = await loadMercadoPago(link.mp.publicKey);
        const token = await mp.createCardToken({
          cardNumber: digits(cardNumber),
          cardholderName: cardName.trim(),
          cardExpirationMonth: digits(month || "").padStart(2, "0"),
          cardExpirationYear: `20${digits(year || "").slice(-2)}`,
          securityCode: digits(cardCvv),
          identificationType: "CPF",
          identificationNumber: digits(cpf),
        });
        cardToken = token.id;
      }
      const res = await fetch(`/api/pagar/${encodeURIComponent(link.token)}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          name,
          email,
          cpf: digits(cpf),
          ...(method === "card" ? { cardToken, paymentMethodId: brand, installments } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        status?: "PAID" | "PENDING";
        verificationUrl?: string;
      };
      if (!res.ok) throw new Error(body.error || "Não foi possível processar o pagamento.");
      if (body.status === "PAID") {
        setStatus("PAID");
        return;
      }
      if (method === "pix") {
        const fresh = await fetch(`/api/pagar/${encodeURIComponent(link.token)}`).then((r) => r.json());
        setPix({ code: fresh.link?.pixQrCode ?? null, image: fresh.link?.pixQrCodeBase64 ?? null });
      }
      if (body.verificationUrl) setVerificationUrl(body.verificationUrl);
      setWaiting(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível processar o pagamento.");
    } finally {
      setPending(false);
    }
  }

  const selected = options.find((o) => o.installments === installments);
  const scopeStyle = { "--on-primary": link.brand.buttonText } as CSSProperties;
  const parcelLine =
    link.maxInstallments > 1 ? `Em até ${link.maxInstallments}x no cartão ou à vista no Pix` : "À vista no Pix ou no cartão";

  return (
    <BrandThemeScope primaryColor={link.brand.accent} className="min-h-screen bg-[var(--canvas-parchment)]">
      <div style={scopeStyle} className="flex min-h-screen flex-col">
        <header className="flex h-16 items-center justify-center px-5" style={{ background: link.brand.headerBg }}>
          {link.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={link.brand.logoUrl} alt={link.brand.storeName} className="h-8 w-auto max-w-[180px] object-contain" />
          ) : (
            <span className="type-tagline text-[var(--ink)]">{link.brand.storeName}</span>
          )}
        </header>

        <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8 md:py-12">
          <section className="rounded-[var(--radius-lg)] bg-[var(--canvas)] p-6 md:p-8">
            <p className="type-caption text-[var(--ink-muted-48)]">Pagamento · Ref. {link.ref}</p>
            <h1 className="mt-1 type-body-strong text-[var(--ink)]">{link.description}</h1>
            <p className="mt-4 type-display-lg text-[var(--ink)]">{brl(link.amountCents)}</p>
            <p className="mt-1 type-caption text-[var(--ink-muted-80)]">{parcelLine}</p>
          </section>

          <section className="mt-4 rounded-[var(--radius-lg)] bg-[var(--canvas)] p-6 md:p-8">
            {status === "PAID" ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--primary)]" strokeWidth={1.5} />
                <p className="mt-3 type-tagline text-[var(--ink)]">Pagamento confirmado</p>
                <p className="mt-1 type-body text-[var(--ink-muted-80)]">
                  Obrigado! A equipe da {link.brand.storeName} já foi avisada.
                </p>
              </div>
            ) : status === "EXPIRED" || status === "CANCELED" || status === "REFUNDED" ? (
              <div className="py-4 text-center">
                <p className="type-tagline text-[var(--ink)]">
                  {status === "EXPIRED" ? "Este link expirou" : "Este link não está mais ativo"}
                </p>
                <p className="mt-1 type-body text-[var(--ink-muted-80)]">
                  Fale com a equipe da {link.brand.storeName} para receber um novo link.
                </p>
              </div>
            ) : !link.mp.connected ? (
              <p className="type-body text-[var(--ink-muted-80)]">
                O pagamento online ainda não está disponível. Fale com a equipe da {link.brand.storeName}.
              </p>
            ) : waiting && method === "pix" && (pix.code || pix.image) ? (
              <div className="space-y-4 text-center">
                <p className="type-body-strong text-[var(--ink)]">Pague com Pix</p>
                <p className="type-caption text-[var(--ink-muted-80)]">
                  Abra o app do seu banco, escolha Pix e leia o QR Code ou cole o código. A confirmação aparece aqui sozinha.
                </p>
                {pix.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${pix.image}`}
                    alt="QR Code do Pix"
                    className="mx-auto w-56 rounded-[var(--radius-xs)] border border-[var(--hairline)]"
                  />
                ) : null}
                {pix.code ? (
                  <>
                    <p className="break-all rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] p-3 text-left type-fine-print text-[var(--ink-muted-80)]">
                      {pix.code}
                    </p>
                    <Button
                      type="button"
                      variant="store-hero"
                      className="w-full"
                      onClick={() => void navigator.clipboard.writeText(pix.code || "").then(() => setCopied(true))}
                    >
                      {copied ? "Código copiado" : "Copiar código Pix"}
                    </Button>
                  </>
                ) : null}
                <p className="flex items-center justify-center gap-2 type-caption text-[var(--ink-muted-48)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Aguardando o pagamento…
                </p>
              </div>
            ) : waiting && method === "card" ? (
              <div className="space-y-3 py-2 text-center">
                {verificationUrl ? (
                  <>
                    <p className="type-body text-[var(--ink)]">O banco pediu uma verificação extra do cartão.</p>
                    <a href={verificationUrl} className="type-body-strong text-[var(--primary)]">
                      Continuar a verificação
                    </a>
                  </>
                ) : (
                  <p className="type-body text-[var(--ink)]">Pagamento em análise pelo banco.</p>
                )}
                <p className="flex items-center justify-center gap-2 type-caption text-[var(--ink-muted-48)]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Aguardando a confirmação…
                </p>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <SegmentedControl
                  value={method}
                  onChange={(v) => {
                    setMethod(v);
                    setError("");
                  }}
                  options={[
                    { value: "pix", label: "Pix" },
                    { value: "card", label: "Cartão de crédito" },
                  ]}
                  aria-label="Forma de pagamento"
                  className="w-full"
                />
                <TextField label="Nome completo" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <TextField
                  label={method === "card" ? "CPF do titular do cartão" : "CPF"}
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
                {method === "card" ? (
                  <>
                    <TextField
                      label="Número do cartão"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(maskCard(e.target.value))}
                      inputMode="numeric"
                      autoComplete="cc-number"
                    />
                    <TextField label="Nome impresso no cartão" value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="cc-name" />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        label="Validade"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(maskExpiry(e.target.value))}
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="MM/AA"
                      />
                      <TextField
                        label="CVV"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(digits(e.target.value).slice(0, 4))}
                        inputMode="numeric"
                        autoComplete="cc-csc"
                      />
                    </div>
                    {options.length ? (
                      <div>
                        <p className="type-caption-strong text-[var(--ink)]">Parcelas</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {options.map((o) => (
                            <OptionChip
                              key={o.installments}
                              selected={o.installments === installments}
                              onClick={() => setInstallments(o.installments)}
                            >
                              {o.label}
                            </OptionChip>
                          ))}
                        </div>
                        {selected && selected.totalAmountCents > link.amountCents ? (
                          <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
                            Total no cartão: {brl(selected.totalAmountCents)} (inclui juros da operadora)
                          </p>
                        ) : null}
                      </div>
                    ) : binKey.length >= 6 && !error ? (
                      <p className="flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
                        <Loader2 className="h-4 w-4 animate-spin" /> Consultando parcelas…
                      </p>
                    ) : null}
                  </>
                ) : null}
                {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
                <Button type="submit" variant="store-hero" className="w-full" disabled={pending}>
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : method === "pix" ? (
                    `Gerar Pix de ${brl(link.amountCents)}`
                  ) : selected ? (
                    `Pagar ${selected.label}`
                  ) : (
                    `Pagar ${brl(link.amountCents)}`
                  )}
                </Button>
              </form>
            )}
          </section>

          <p className="mt-5 flex items-center justify-center gap-1.5 type-fine-print text-[var(--ink-muted-48)]">
            <Lock className="h-3.5 w-3.5" /> Pagamento seguro processado pelo Mercado Pago
          </p>
        </main>

        <footer className="px-5 pb-8 text-center type-fine-print text-[var(--ink-muted-48)]">
          {link.brand.footer || link.brand.storeName}
        </footer>
      </div>
    </BrandThemeScope>
  );
}
