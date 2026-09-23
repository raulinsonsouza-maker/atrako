"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { Download } from "lucide-react";
import {
  buildFbc,
  buildProductEventParams,
  getMetaAttribution,
  newMetaEventId,
  trackMeta,
  trackMetaDual,
} from "@/components/meta/MetaPixel";
import { EbookCover } from "@/components/marketing/EbookCover";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";
import { formatBRL, formatCpf, formatPhone } from "@/lib/utils";

type BumpOffer = {
  id: string;
  offeredProductId: string;
  discountPercent: number;
  headline: string | null;
  description: string | null;
  offeredProduct: { id: string; name: string; priceCents: number };
};

type Prefill = {
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
};

type DownloadFile = {
  id: string;
  name: string;
  mimeType?: string | null;
  sizeBytes?: number;
};

type Props = {
  product: {
    id: string;
    name: string;
    priceCents: number;
    maxInstallments: number | null;
    description?: string | null;
    bullets?: string[];
  };
  bump: BumpOffer | null;
  paymentSettings: {
    cardEnabled: boolean;
    pixEnabled: boolean;
    maxInstallments: number;
    minInstallments: number;
  };
  discountedPriceCents?: number;
  parentOrderId?: string;
  prefill?: Prefill;
  /** Embutido na landing: sem redirect; PIX + download na mesma página. */
  embedded?: boolean;
};

function firstParam(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CheckoutForm({
  product,
  bump,
  paymentSettings,
  discountedPriceCents,
  parentOrderId,
  prefill,
  embedded = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const basePrice = discountedPriceCents ?? product.priceCents;

  const [name, setName] = useState(prefill?.name ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [cpf, setCpf] = useState(prefill?.cpf ? formatCpf(prefill.cpf) : "");
  const [phone, setPhone] = useState(prefill?.phone ? formatPhone(prefill.phone) : "");
  const [coupon, setCoupon] = useState("");
  const [terms, setTerms] = useState(false);
  const [bumpSelected, setBumpSelected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [mpReady, setMpReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [brickKey, setBrickKey] = useState(0);
  const [showCard, setShowCard] = useState(false);

  const [phase, setPhase] = useState<"form" | "pix" | "unlocked">("form");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [purchaseEventId, setPurchaseEventId] = useState<string | null>(null);
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixCopyPaste, setPixCopyPaste] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<DownloadFile[]>([]);
  const [checkoutStarted, setCheckoutStarted] = useState(false);

  const bumpPrice = useMemo(() => {
    if (!bump) return 0;
    return Math.round(bump.offeredProduct.priceCents * (1 - bump.discountPercent / 100));
  }, [bump]);

  const amountCents = basePrice + (bumpSelected && bump ? bumpPrice : 0);
  const amount = amountCents / 100;
  const maxInstallments = Math.min(
    product.maxInstallments ?? paymentSettings.maxInstallments,
    paymentSettings.maxInstallments,
  );
  const bullets = product.bullets?.length
    ? product.bullets
    : [
        "Acesso imediato após o pagamento",
        "Arquivo em PDF para baixar quando quiser",
        "Pagamento único, sem mensalidade",
      ];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mp/public-key");
        if (!res.ok) {
          if (!cancelled) setPublicKey(null);
          return;
        }
        const data = (await res.json()) as { publicKey?: string };
        if (!cancelled && data.publicKey) {
          initMercadoPago(data.publicKey, { locale: "pt-BR" });
          setPublicKey(data.publicKey);
          setMpReady(true);
        }
      } catch {
        if (!cancelled) setPublicKey(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setBrickKey((k) => k + 1);
  }, [amount, bumpSelected]);

  useEffect(() => {
    if (!embedded || phase !== "pix" || !orderId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/mp/order-status?orderId=${encodeURIComponent(orderId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          status?: string;
          pixQrCodeBase64?: string | null;
          pixCopyPaste?: string | null;
          files?: DownloadFile[];
        };
        if (data.pixQrCodeBase64) setPixQrBase64(data.pixQrCodeBase64);
        if (data.pixCopyPaste) setPixCopyPaste(data.pixCopyPaste);
        if (data.status === "APPROVED") {
          clearInterval(timer);
          unlockPurchase(orderId, data.files ?? [], purchaseEventId);
        }
      } catch {
        // keep polling
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [embedded, phase, orderId]);

  function fireInitiateCheckout() {
    if (checkoutStarted) return;
    setCheckoutStarted(true);
    const contentIds = [product.id];
    if (bumpSelected && bump) contentIds.push(bump.offeredProductId);
    trackMetaDual({
      eventName: "InitiateCheckout",
      productId: product.id,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      externalId: cpf.replace(/\D/g, "") || undefined,
      params: buildProductEventParams({
        contentIds,
        value: amountCents / 100,
        contentName: product.name,
        contents: [
          { id: product.id, quantity: 1, item_price: basePrice / 100 },
          ...(bumpSelected && bump
            ? [{ id: bump.offeredProductId, quantity: 1, item_price: bumpPrice / 100 }]
            : []),
        ],
      }),
      onceKey: `ic_${product.id}`,
    });
  }

  function attribution(eventId: string) {
    const fbclid = firstParam(searchParams.get("fbclid"));
    const meta = getMetaAttribution(searchParams);
    return {
      fbp: meta.fbp,
      fbc: meta.fbc || buildFbc(fbclid),
      fbclid,
      eventId,
      utmSource: firstParam(searchParams.get("utm_source")),
      utmMedium: firstParam(searchParams.get("utm_medium")),
      utmCampaign: firstParam(searchParams.get("utm_campaign")),
      utmContent: firstParam(searchParams.get("utm_content")),
      utmTerm: firstParam(searchParams.get("utm_term")),
    };
  }

  function validateBuyer() {
    if (!name.trim() || name.trim().length < 2) return "Informe seu nome";
    if (!email.trim()) return "Informe seu e-mail";
    if (!cpf.trim()) return "Informe seu CPF";
    if (!embedded && !phone.trim()) return "Informe seu telefone";
    if (!embedded && !terms) return "Aceite os termos para continuar";
    return null;
  }

  function unlockPurchase(
    nextOrderId: string,
    nextFiles: DownloadFile[],
    eventId?: string | null,
  ) {
    setOrderId(nextOrderId);
    setFiles(nextFiles);
    setPhase("unlocked");

    const eid = eventId || purchaseEventId;
    if (eid) {
      const contentIds = [product.id];
      if (bumpSelected && bump) contentIds.push(bump.offeredProductId);
      const onceKey = `purchase_${eid}`;
      try {
        if (!sessionStorage.getItem(`meta_${onceKey}`)) {
          sessionStorage.setItem(`meta_${onceKey}`, "1");
          trackMeta(
            "Purchase",
            buildProductEventParams({
              contentIds,
              value: amountCents / 100,
              contentName: product.name,
              contents: [
                { id: product.id, quantity: 1, item_price: basePrice / 100 },
                ...(bumpSelected && bump
                  ? [{ id: bump.offeredProductId, quantity: 1, item_price: bumpPrice / 100 }]
                  : []),
              ],
            }),
            eid,
          );
        }
      } catch {
        trackMeta(
          "Purchase",
          buildProductEventParams({
            contentIds,
            value: amountCents / 100,
            contentName: product.name,
          }),
          eid,
        );
      }
    }

    requestAnimationFrame(() => {
      const formEl = document.getElementById("checkout-form");
      (formEl ?? document.getElementById("checkout"))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function createOrder(payment: Record<string, unknown>) {
    const validationError = validateBuyer();
    if (validationError) {
      setError(validationError);
      throw new Error(validationError);
    }

    fireInitiateCheckout();

    const eventId = newMetaEventId();
    setPurchaseEventId(eventId);

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mp/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          bumpProductId: bumpSelected && bump ? bump.offeredProductId : undefined,
          email: email.trim(),
          name: name.trim(),
          cpf,
          phone,
          couponCode: coupon.trim() || undefined,
          termsAccepted: embedded ? true : terms,
          payment,
          attribution: attribution(eventId),
          parentOrderId,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        redirectTo?: string;
        orderId?: string;
        eventId?: string;
        status?: string;
        files?: DownloadFile[];
        pixQrCodeBase64?: string | null;
        pixCopyPaste?: string | null;
        pixQrCode?: string | null;
      };
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível criar o pedido");
      }

      const resolvedEventId = data.eventId || eventId;
      setPurchaseEventId(resolvedEventId);

      if (embedded) {
        if (data.status === "APPROVED" && data.orderId) {
          unlockPurchase(data.orderId, data.files ?? [], resolvedEventId);
          return;
        }
        if (data.status === "PENDING" && data.orderId) {
          setOrderId(data.orderId);
          setPixQrBase64(data.pixQrCodeBase64 ?? null);
          setPixCopyPaste(data.pixCopyPaste ?? data.pixQrCode ?? null);
          setPhase("pix");
          requestAnimationFrame(() => {
            document
              .getElementById("checkout")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
          return;
        }
      }

      router.push(data.redirectTo || `/obrigado?orderId=${data.orderId}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro no pagamento";
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function payWithPix() {
    await createOrder({ type: "pix" }).catch(() => undefined);
  }

  async function onBrickSubmit(brickPayload: {
    paymentType?: string;
    selectedPaymentMethod?: string;
    formData?: {
      token?: string;
      installments?: number;
      payment_method_id?: string;
    };
  }) {
    const fd = brickPayload.formData ?? {};
    const method =
      brickPayload.selectedPaymentMethod ||
      brickPayload.paymentType ||
      fd.payment_method_id ||
      "";

    const isPix =
      method === "bank_transfer" ||
      method === "pix" ||
      fd.payment_method_id === "pix";

    if (isPix) {
      await createOrder({ type: "pix" });
      return;
    }

    await createOrder({
      type: "credit_card",
      token: fd.token || "",
      installments: fd.installments || 1,
      paymentMethodId: fd.payment_method_id || "visa",
    });
  }

  function onBumpChange(checked: boolean) {
    setBumpSelected(checked);
    if (checked && bump) {
      trackMetaDual({
        eventName: "AddToCart",
        productId: product.id,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        externalId: cpf.replace(/\D/g, "") || undefined,
        params: buildProductEventParams({
          contentIds: [bump.offeredProductId],
          value: bumpPrice / 100,
          contentName: bump.offeredProduct.name,
          contents: [
            { id: bump.offeredProductId, quantity: 1, item_price: bumpPrice / 100 },
          ],
        }),
      });
    }
  }

  async function copyPixCode() {
    if (!pixCopyPaste) return;
    await navigator.clipboard.writeText(pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const pixEnabled = paymentSettings.pixEnabled;

  if (embedded && phase === "unlocked") {
    const primary = files[0];
    const downloadHref = primary
      ? `/api/orders/download?orderId=${encodeURIComponent(orderId || "")}&fileId=${encodeURIComponent(primary.id)}`
      : null;

    return (
      <div className="checkout-unlocked">
        <Panel className="stack items-center text-center checkout-unlocked__panel">
          <p className="m-0 label-tech text-[var(--success)]">Tudo certo</p>
          <h2 className="m-0 text-[var(--text-2xl)] tracking-[-0.02em]">Suas receitas já estão aqui</h2>
          <p className="m-0 text-[var(--muted)] max-w-md">
            Toque abaixo e baixe agora. Também enviamos para{" "}
            <strong className="text-[var(--ink)]">{email}</strong>, para você guardar.
          </p>

          {downloadHref ? (
            <a
              href={downloadHref}
              className="checkout-download-icon no-underline"
              download={primary?.name}
              aria-label={`Baixar ${primary?.name || "seu guia"}`}
            >
              <Download size={36} strokeWidth={1.75} />
              <span>Baixar agora</span>
            </a>
          ) : (
            <Alert tone="info">Arquivo ainda não disponível. Atualize em instantes.</Alert>
          )}

          {primary ? (
            <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">
              {primary.name}
              {formatFileSize(primary.sizeBytes) ? ` · ${formatFileSize(primary.sizeBytes)}` : ""}
            </p>
          ) : null}

          {files.length > 1 ? (
            <ul className="m-0 p-0 list-none stack-sm w-full max-w-sm text-left">
              {files.slice(1).map((file) => (
                <li key={file.id}>
                  <a
                    className="text-[var(--ink)] underline decoration-[var(--accent)] text-[var(--text-sm)]"
                    href={`/api/orders/download?orderId=${encodeURIComponent(orderId || "")}&fileId=${encodeURIComponent(file.id)}`}
                  >
                    Baixar {file.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </div>
    );
  }

  if (embedded && phase === "pix") {
    return (
      <Panel className="stack items-center text-center">
        <h2 className="m-0 text-[var(--text-xl)]">Quase lá</h2>
        <p className="m-0 text-[var(--muted)] text-[var(--text-sm)] max-w-sm">
          Abra o app do banco, pague o PIX e fique nesta página. Assim que confirmar, suas receitas
          liberam aqui.
        </p>
        {pixQrBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${pixQrBase64}`}
            alt="QR Code PIX"
            className="w-56 h-56 object-contain rounded-[var(--radius-md)] bg-white p-2"
          />
        ) : (
          <Alert tone="info">
            Estamos gerando seu pagamento. Em instantes o código aparece aqui.
          </Alert>
        )}
        {pixCopyPaste ? (
          <div className="stack-sm w-full max-w-md text-left">
            <textarea
              readOnly
              value={pixCopyPaste}
              className="w-full min-h-24 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3 text-[var(--text-sm)] text-[var(--ink)]"
            />
            <Button onClick={copyPixCode}>{copied ? "Código copiado!" : "Copiar código PIX"}</Button>
          </div>
        ) : null}
        <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">
          Aguardando o banco confirmar…
        </p>
      </Panel>
    );
  }

  return (
    <div className={embedded ? "checkout-offer checkout-offer--embedded" : "checkout-offer"}>
      {!embedded ? (
        <aside className="checkout-offer__summary stack">
          <EbookCover className="ebook-cover--checkout" />
          <div className="stack-sm">
            <p className="m-0 label-tech">Seu pedido</p>
            <h1 className="m-0 text-[var(--text-2xl)] tracking-[-0.02em]">{product.name}</h1>
            {product.description ? (
              <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">{product.description}</p>
            ) : null}
            <p className="m-0 text-[var(--text-3xl)] font-semibold tabular-nums text-[var(--ink)]">
              {formatBRL(basePrice)}
            </p>
            {discountedPriceCents != null && discountedPriceCents < product.priceCents ? (
              <p className="m-0 text-[var(--text-sm)] text-[var(--muted)] line-through">
                {formatBRL(product.priceCents)}
              </p>
            ) : null}
          </div>
          <ul className="sales-trust">
            {bullets.slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {pixEnabled ? (
            <div className="checkout-pix-hint">
              <div>
                <strong>PIX libera na hora.</strong>
                <p className="m-0 mt-1">
                  Pague {formatBRL(amountCents)}, confirme no app do banco e baixe o PDF em seguida.
                </p>
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}

      <Panel className="stack">
        {!embedded ? (
          <div className="stack-sm">
            <h2 className="m-0 text-[var(--text-xl)]">Seus dados</h2>
            <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">
              Usamos o e-mail para enviar o acesso assim que o pagamento for aprovado.
            </p>
          </div>
        ) : null}

        <Field label="Nome" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </Field>
        <Field label="E-mail" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.replace(/\s/g, "").toLowerCase())}
            autoComplete="email"
            placeholder="seu@email.com"
            required
          />
        </Field>
        <Field label="CPF" htmlFor="cpf">
          <Input
            id="cpf"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            maxLength={14}
            required
          />
        </Field>

        {!embedded ? (
          <>
            <Field label="Telefone" htmlFor="phone">
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                maxLength={15}
                required
              />
            </Field>
            <Field label="Cupom (opcional)" htmlFor="coupon">
              <Input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
            </Field>
          </>
        ) : null}

        {!embedded && bump ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--accent)] p-4 stack-sm">
            <Checkbox
              id="bump"
              checked={bumpSelected}
              onChange={(e) => onBumpChange(e.target.checked)}
              label={
                bump.headline ||
                `Adicionar ${bump.offeredProduct.name} por ${formatBRL(bumpPrice)}`
              }
            />
            {bump.description ? (
              <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">{bump.description}</p>
            ) : null}
          </div>
        ) : null}

        {!embedded ? (
          <Checkbox
            id="terms"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            label={
              <>
                Aceito os{" "}
                <a href="/termos" className="text-[var(--ink)] underline decoration-[var(--accent)]">
                  termos
                </a>{" "}
                e a{" "}
                <a href="/privacidade" className="text-[var(--ink)] underline decoration-[var(--accent)]">
                  privacidade
                </a>
                .
              </>
            }
          />
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}

        {pixEnabled ? (
          <Button
            size="lg"
            className={`w-full !h-12${embedded ? " lp-pix-btn" : ""}`}
            disabled={loading}
            onClick={payWithPix}
          >
            {loading
              ? "Preparando seu pagamento…"
              : embedded
                ? `Quero meu guia por ${formatBRL(amountCents)}`
                : `Pagar ${formatBRL(amountCents)} com PIX`}
          </Button>
        ) : null}

        {embedded ? (
          <p className="m-0 text-center text-[0.75rem] text-[var(--muted)] leading-snug">
            Ao pagar, você aceita os{" "}
            <a href="/termos" className="underline">
              termos
            </a>{" "}
            e a{" "}
            <a href="/privacidade" className="underline">
              privacidade
            </a>
            .
          </p>
        ) : null}

        {!embedded && publicKey && mpReady ? (
          <div className="stack-sm">
            {paymentSettings.cardEnabled ? (
              <button
                type="button"
                className="bg-transparent border-0 p-0 text-[var(--text-sm)] text-[var(--muted)] underline cursor-pointer text-left"
                onClick={() => setShowCard((v) => !v)}
              >
                {showCard ? "Ocultar cartão" : "Prefere cartão? Ver opções"}
              </button>
            ) : null}
            {(showCard || !pixEnabled) && paymentSettings.cardEnabled ? (
              <div key={brickKey}>
                <Payment
                  initialization={{ amount }}
                  customization={
                    {
                      paymentMethods: {
                        creditCard: "all",
                        bankTransfer: pixEnabled ? "all" : undefined,
                        maxInstallments,
                        minInstallments: paymentSettings.minInstallments,
                      },
                    } as Parameters<typeof Payment>[0]["customization"]
                  }
                  onSubmit={async (param) => {
                    await onBrickSubmit(param as Parameters<typeof onBrickSubmit>[0]);
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {!embedded && !(publicKey && mpReady) ? (
          <div className="stack">
            {!pixEnabled ? (
              <Alert tone="info">
                Modo demo: Mercado Pago não conectado. Use o botão abaixo para simular.
              </Alert>
            ) : null}
            {paymentSettings.cardEnabled ? (
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() =>
                  createOrder({
                    type: "credit_card",
                    token: "demo",
                    installments: 1,
                    paymentMethodId: "visa",
                  }).catch(() => undefined)
                }
              >
                Cartão demo
              </Button>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
