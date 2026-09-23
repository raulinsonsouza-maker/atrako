"use client";

import { useEffect, useState } from "react";
import { trackMeta } from "@/components/meta/MetaPixel";

type Theme = "airfryer" | "plantas" | "bolos";

type DownloadFile = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
};

type Props = {
  orderId: string;
  initialStatus: string;
  initialQrBase64: string | null;
  initialCopyPaste: string | null;
  initialFiles: DownloadFile[];
  productName: string;
  productId?: string;
  coverUrl: string;
  priceLabel: string;
  customerEmail: string;
  eventId?: string | null;
  totalCents: number;
  theme: Theme;
};

const WAITING_COPY: Record<Theme, string> = {
  airfryer: "Assim que o PIX for confirmado, seu guia libera na hora.",
  plantas: "Assim que o PIX for confirmado, seu Tratado libera na hora.",
  bolos: "Assim que o PIX for confirmado, suas receitas liberam na hora.",
};

const UNLOCKED_TITLE: Record<Theme, string> = {
  airfryer: "Seu guia já está liberado",
  plantas: "Seu Tratado já está liberado",
  bolos: "Suas receitas já estão liberadas",
};

function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PixStatusClient({
  orderId,
  initialStatus,
  initialQrBase64,
  initialCopyPaste,
  initialFiles,
  productName,
  productId,
  coverUrl,
  priceLabel,
  customerEmail,
  eventId,
  totalCents,
  theme,
}: Props) {
  const [qrBase64, setQrBase64] = useState(initialQrBase64);
  const [copyPaste, setCopyPaste] = useState(initialCopyPaste);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(initialStatus || "PENDING");
  const [files, setFiles] = useState<DownloadFile[]>(initialFiles);
  const unlocked = status === "APPROVED";

  useEffect(() => {
    if (unlocked) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/mp/order-status?orderId=${encodeURIComponent(orderId)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          status?: string;
          pixQrCodeBase64?: string | null;
          pixCopyPaste?: string | null;
          files?: DownloadFile[];
        };
        if (data.pixQrCodeBase64) setQrBase64(data.pixQrCodeBase64);
        if (data.pixCopyPaste) setCopyPaste(data.pixCopyPaste);
        if (data.status) setStatus(data.status);
        if (data.status === "APPROVED") {
          clearInterval(timer);
          setFiles(data.files ?? []);
          if (eventId) {
            const onceKey = `purchase_${eventId}`;
            try {
              if (!sessionStorage.getItem(`meta_${onceKey}`)) {
                sessionStorage.setItem(`meta_${onceKey}`, "1");
                trackMeta(
                  "Purchase",
                  {
                    content_ids: productId ? [productId] : undefined,
                    content_name: productName,
                    content_type: "product",
                    value: totalCents / 100,
                    currency: "BRL",
                    num_items: 1,
                  },
                  eventId,
                );
              }
            } catch {
              // ignore storage errors
            }
          }
        }
      } catch {
        // keep polling
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [orderId, unlocked, eventId, productId, productName, totalCents]);

  async function copyCode() {
    if (!copyPaste) return;
    await navigator.clipboard.writeText(copyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const primary = files[0];
  const downloadHref = primary
    ? `/api/orders/download?orderId=${encodeURIComponent(orderId)}&fileId=${encodeURIComponent(primary.id)}`
    : null;

  if (unlocked) {
    return (
      <section className="lp-pix lp-pix--unlocked" aria-labelledby="lp-pix-title">
        <div className="lp-pix__inner">
          <header className="lp-pix__product">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              className="lp-pix__cover"
              width={96}
              height={128}
            />
            <div className="lp-pix__product-copy">
              <p className="lp-pix__eyebrow lp-pix__eyebrow--ok">Pagamento confirmado</p>
              <h1 id="lp-pix-title" className="lp-pix__title">
                {productName}
              </h1>
              <p className="lp-pix__price">
                Total <strong>{priceLabel}</strong>
              </p>
            </div>
          </header>

          <div className="lp-pix__panel lp-pix__panel--success">
            <h2 className="lp-pix__panel-title">{UNLOCKED_TITLE[theme]}</h2>
            <p className="lp-pix__panel-lead">
              Baixe agora nesta página. Também enviamos o link para{" "}
              <strong>{customerEmail}</strong>.
            </p>

            {downloadHref ? (
              <a
                href={downloadHref}
                className="lp-cta lp-cta--full lp-pix__download-btn"
                download={primary?.name}
              >
                Baixar agora
              </a>
            ) : (
              <p className="lp-pix__hint">
                Arquivo ainda sincronizando… atualize em alguns segundos.
              </p>
            )}

            {primary ? (
              <p className="lp-pix__file-meta">
                {primary.name}
                {formatFileSize(primary.sizeBytes)
                  ? ` · ${formatFileSize(primary.sizeBytes)}`
                  : ""}
              </p>
            ) : null}

            {files.length > 1 ? (
              <ul className="lp-pix__extra-files">
                {files.slice(1).map((file) => (
                  <li key={file.id}>
                    <a
                      href={`/api/orders/download?orderId=${encodeURIComponent(orderId)}&fileId=${encodeURIComponent(file.id)}`}
                    >
                      Baixar {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <ul className="lp-pix__trust">
            <li>E-mail de entrega enviado para {customerEmail}</li>
            <li>Guarde este link — você pode baixar de novo quando quiser</li>
            <li>Dúvidas: vendas@prospectads.com.br</li>
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section className="lp-pix" aria-labelledby="lp-pix-title">
      <div className="lp-pix__inner">
        <header className="lp-pix__product">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="lp-pix__cover"
            width={96}
            height={128}
          />
          <div className="lp-pix__product-copy">
            <p className="lp-pix__eyebrow">Pedido reservado</p>
            <h1 id="lp-pix-title" className="lp-pix__title">
              {productName}
            </h1>
            <p className="lp-pix__price">
              Total <strong>{priceLabel}</strong>
            </p>
          </div>
        </header>

        <div className="lp-pix__panel">
          <h2 className="lp-pix__panel-title">Finalize com PIX</h2>
          <p className="lp-pix__panel-lead">
            Escaneie o QR Code no app do seu banco ou copie o código. Fique nesta
            página — o download libera automaticamente.
          </p>

          <div className="lp-pix__qr-wrap">
            {qrBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${qrBase64}`}
                alt="QR Code PIX"
                className="lp-pix__qr"
                width={224}
                height={224}
              />
            ) : (
              <p className="lp-pix__qr-wait">Gerando QR Code…</p>
            )}
          </div>

          {copyPaste ? (
            <div className="lp-pix__copy-block">
              <label className="lp-pix__copy-label" htmlFor="pix-code">
                Código copia e cola
              </label>
              <textarea
                id="pix-code"
                readOnly
                value={copyPaste}
                className="lp-pix__code"
                rows={3}
              />
              <button
                type="button"
                className="lp-cta lp-cta--full lp-pix__copy-btn"
                onClick={copyCode}
              >
                {copied ? "Código copiado!" : "Copiar código PIX"}
              </button>
            </div>
          ) : null}

          <p className="lp-pix__status" role="status" aria-live="polite">
            <span className="lp-pix__status-dot" aria-hidden />
            Aguardando confirmação do pagamento…
          </p>
          <p className="lp-pix__hint">{WAITING_COPY[theme]}</p>
        </div>

        <ul className="lp-pix__trust">
          <li>Pagamento processado pelo Mercado Pago</li>
          <li>Download liberado nesta página após a confirmação</li>
          <li>E-mail com o mesmo link enviado automaticamente</li>
        </ul>
      </div>
    </section>
  );
}
