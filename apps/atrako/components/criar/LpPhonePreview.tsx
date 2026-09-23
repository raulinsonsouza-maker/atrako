"use client";

import { ExternalLink } from "lucide-react";

export type LpPreviewDraft = {
  brandName?: string;
  headline: string;
  subheadline?: string;
  bullets?: string[];
  priceLabel?: string;
  cta?: string;
};

type Props = {
  /** URL pública — se existir, usa iframe (pós-publicação). */
  src?: string | null;
  /** Preview ao vivo enquanto edita (antes de publicar). */
  draft?: LpPreviewDraft | null;
  title?: string;
  openHref?: string | null;
};

function DraftScreen({ draft }: { draft: LpPreviewDraft }) {
  const bullets = (draft.bullets ?? []).filter(Boolean);
  return (
    <div className="lp-phone-draft">
      <div className="lp-phone-draft-nav">
        <span className="truncate type-micro-legal text-[var(--ink-muted-48)]">
          {draft.brandName || "Sua marca"}
        </span>
        <span className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-2.5 py-1 type-micro-legal text-[var(--on-primary)]">
          {draft.cta || "Quero comprar"}
        </span>
      </div>
      <div className="lp-phone-draft-body">
        <p className="type-micro-legal uppercase tracking-wide text-[var(--ink-muted-48)]">
          {draft.brandName || "Oferta"}
        </p>
        <h2 className="lp-phone-draft-headline">
          {draft.headline || "Headline da página"}
        </h2>
        {draft.subheadline ? (
          <p className="type-fine-print text-[var(--ink-muted-80)]">{draft.subheadline}</p>
        ) : null}
        {bullets.length > 0 ? (
          <ul className="lp-phone-draft-bullets">
            {bullets.map((b) => (
              <li key={b}>
                <span aria-hidden>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {draft.priceLabel ? (
          <p className="lp-phone-draft-price">{draft.priceLabel}</p>
        ) : null}
        <span className="lp-phone-draft-cta">{draft.cta || "Quero comprar"}</span>
      </div>
    </div>
  );
}

/** Preview em moldura de iPhone — iframe (live) ou draft ao vivo. */
export function LpPhonePreview({ src, draft, title = "Preview", openHref }: Props) {
  const hasLive = Boolean(src);
  const href = openHref || src || null;

  return (
    <div className="lp-preview">
      <div className="lp-preview-toolbar">
        <p className="type-fine-print text-[var(--ink-muted-48)]">Pré-visualização</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 type-fine-print text-[var(--primary)] active:scale-95"
          >
            Abrir página
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
        ) : null}
      </div>
      <div className="lp-preview-stage">
        <div className="lp-phone">
          <div className="lp-phone-screen">
            <div className="lp-phone-island" aria-hidden />
            {hasLive ? (
              <iframe title={title} src={src!} className="lp-phone-iframe" />
            ) : draft ? (
              <DraftScreen draft={draft} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <p className="type-fine-print text-[var(--ink-muted-48)]">
                  Preencha a oferta para ver o preview
                </p>
              </div>
            )}
            <div className="lp-phone-home" aria-hidden>
              <div className="lp-phone-home-bar" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
