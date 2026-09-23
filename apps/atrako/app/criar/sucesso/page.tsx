"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { CopyLinkButton, UrlPreview } from "@/components/criar/CopyLinkButton";
import { LpPhonePreview } from "@/components/criar/LpPhonePreview";

function SuccessInner() {
  const sp = useSearchParams();
  const kind = sp.get("kind") || "oferta";
  const slug = sp.get("slug") || "";
  const id = sp.get("id") || "";
  const name = sp.get("name") || "Publicado";
  const page = sp.get("page") || "";

  const path =
    kind === "formulario"
      ? `/f/${slug}`
      : kind === "oferta"
        ? `/p/${slug}`
        : kind === "agenda"
          ? slug
            ? page
              ? `/b/${slug}/${page}`
              : `/b/${slug}`
            : "/agenda"
          : kind === "servico"
          ? slug
            ? `/b/${slug}`
            : "/agenda"
          : kind === "cupom" || kind === "upsell"
            ? "/commerce"
            : kind === "campanha_meta" || kind === "campanha-meta"
              ? id
                ? `/criar/campanha-meta/${id}`
                : "/criar/campanha-meta"
              : id
                ? `/social/flows/${id}`
                : "/social/flows";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const hasPublicUrl =
    kind === "oferta" ||
    kind === "formulario" ||
    kind === "servico" ||
    kind === "agenda";
  const fullUrl = hasPublicUrl ? `${origin}${path}` : "";

  const title =
    kind === "formulario"
      ? "Formulário no ar"
      : kind === "automacao"
        ? "Automação ativa"
        : kind === "agenda"
          ? "Agenda no ar"
          : kind === "servico"
          ? "Serviço na agenda"
          : kind === "cupom"
            ? "Cupom criado"
            : kind === "upsell"
              ? "Upsell ativo"
              : kind === "campanha_meta" || kind === "campanha-meta"
                ? "Campanha Meta"
                : "Oferta no ar";

  const openLabel =
    kind === "automacao"
      ? "Abrir fluxo"
      : kind === "cupom" || kind === "upsell"
        ? "Ver na Loja"
        : kind === "servico" || kind === "agenda"
          ? "Abrir página"
          : kind === "campanha_meta" || kind === "campanha-meta"
            ? "Abrir campanha"
            : "Abrir página";

  return (
    <AppPage title="Pronto">
      <div
        className={
          kind === "oferta" && hasPublicUrl
            ? "criar-oferta-layout"
            : "flex max-w-xl flex-col items-start gap-5"
        }
      >
        <div className="flex min-w-0 flex-col items-start gap-5">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)]">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="type-tagline text-[var(--ink)]">{title}</h2>
            <p className="mt-1 type-body text-[var(--ink-muted-80)]">{name}</p>
          </div>

          {hasPublicUrl ? (
            <div className="w-full space-y-2">
              <p className="type-micro-legal text-[var(--ink-muted-48)]">URL pública</p>
              <UrlPreview path={path} />
            </div>
          ) : kind === "automacao" ? (
            <p className="type-caption text-[var(--ink-muted-80)]">
              Fluxo ativo no Instagram. Leads entram no funil quando houver captura.
            </p>
          ) : kind === "cupom" ? (
            <p className="type-caption text-[var(--ink-muted-80)]">
              Código pronto para usar no checkout.
            </p>
          ) : kind === "upsell" ? (
            <p className="type-caption text-[var(--ink-muted-80)]">
              Oferta complementar ligada aos produtos na Loja.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {hasPublicUrl && fullUrl ? <CopyLinkButton url={fullUrl} /> : null}
            <a
              href={path}
              target={hasPublicUrl || kind === "automacao" ? "_blank" : undefined}
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-[var(--radius-xs)] border border-[var(--primary)] bg-[var(--canvas)] px-[22px] py-[11px] type-body text-[var(--primary)] active:scale-95"
            >
              {openLabel}
            </a>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            {kind === "oferta" || kind === "formulario" || kind === "automacao" ? (
              <Link href="/crm" className="type-caption-strong text-[var(--primary)]">
                Ver no funil
              </Link>
            ) : null}
            {kind === "oferta" || kind === "cupom" || kind === "upsell" ? (
              <Link href="/commerce" className="type-caption-strong text-[var(--primary)]">
                Ver Loja
              </Link>
            ) : null}
            {kind === "oferta" && id ? (
              <>
                <Link
                  href={`/criar/paginas/${encodeURIComponent(id)}`}
                  className="type-caption-strong text-[var(--primary)]"
                >
                  Ver detalhe
                </Link>
                <Link
                  href={`/criar/oferta?mode=manual&productId=${encodeURIComponent(id)}&edit=1`}
                  className="type-caption-strong text-[var(--primary)]"
                >
                  Editar design
                </Link>
              </>
            ) : null}
            {kind === "servico" || kind === "agenda" ? (
              <Link href="/agenda" className="type-caption-strong text-[var(--primary)]">
                Ver Agenda
              </Link>
            ) : null}
            {kind === "automacao" ? (
              <Link href="/social/flows" className="type-caption-strong text-[var(--primary)]">
                Ver Instagram
              </Link>
            ) : null}
            <Link href="/criar" className="type-caption text-[var(--ink-muted-48)]">
              Criar outra
            </Link>
          </div>
        </div>

        {kind === "oferta" && hasPublicUrl ? (
          <LpPhonePreview src={path} openHref={path} title={name} />
        ) : null}
      </div>
    </AppPage>
  );
}

export default function CriarSucessoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
