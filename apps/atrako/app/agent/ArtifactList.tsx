"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { Button, SegmentedControl } from "@/components/ui";
import { buttonClass } from "@/components/ui/button";
import { ChartCard } from "@/components/ui/chart-card";
import type {
  Artifact,
  FormPreviewArtifact,
  LpPreviewArtifact,
  ReferencesArtifact,
  ResourceCreatedArtifact,
  TestResultArtifact,
} from "@/lib/atrako-agent/artifacts";

type Ctx = {
  messageId: string | null;
  conversationId: string | null;
  onAsk?: (text: string) => void;
  onUpdated?: (artifact: Artifact) => void;
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ReferencesCard({ artifact }: { artifact: ReferencesArtifact }) {
  return (
    <div className="assistant-reference-card">
      <p className="type-caption-strong text-[var(--ink)]">{artifact.title}</p>
      <ol className="assistant-reference-list">
        {artifact.items.map((item, i) => (
          <li key={`${item.url}-${i}`}>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="assistant-reference-item">
              <span className="assistant-reference-index type-fine-print">{i + 1}</span>
              <span className="min-w-0">
                <span className="type-caption block truncate text-[var(--ink)]">{item.title || hostOf(item.url)}</span>
                <span className="type-fine-print block truncate text-[var(--ink-muted-48)]">{hostOf(item.url)}</span>
                {item.snippet ? (
                  <span className="assistant-reference-snippet type-fine-print text-[var(--ink-muted-80)]">{item.snippet}</span>
                ) : null}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

const DESKTOP_WIDTH = 1280;
const FRAME_HEIGHT = 560;

/** Iframe da prévia: desktop é renderizado a 1280px e reduzido para caber no card. */
function PreviewFrame({ src, title, device }: { src: string; title: string; device: "desktop" | "mobile" }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(Math.min(1, box.clientWidth / DESKTOP_WIDTH));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={boxRef} className="assistant-lp-preview-frame" data-device={device} style={{ height: FRAME_HEIGHT }}>
      {device === "desktop" ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          style={{
            width: DESKTOP_WIDTH,
            height: FRAME_HEIGHT / scale,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        />
      ) : (
        <iframe src={src} title={title} loading="lazy" className="assistant-lp-preview-phone" />
      )}
    </div>
  );
}

function usePublish(ctx: Ctx, artifact: LpPreviewArtifact | FormPreviewArtifact) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publish = async () => {
    if (!ctx.messageId || !ctx.conversationId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/assistant/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: ctx.conversationId, messageId: ctx.messageId, artifactId: artifact.id }),
      });
      const data = (await r.json().catch(() => ({}))) as { artifact?: Artifact; error?: string };
      if (!r.ok || !data.artifact) {
        setError(data.error ?? "Não foi possível publicar agora.");
        return;
      }
      ctx.onUpdated?.(data.artifact);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, publish };
}

function StatusBadge({ status }: { status: "DRAFT" | "PUBLISHED" }) {
  return (
    <span className="assistant-status-badge type-fine-print" data-status={status}>
      {status === "PUBLISHED" ? "No ar" : "Rascunho"}
    </span>
  );
}

function LpPreviewCard({ artifact, ctx }: { artifact: LpPreviewArtifact; ctx: Ctx }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const { busy, error, publish } = usePublish(ctx, artifact);
  const published = artifact.status === "PUBLISHED";
  return (
    <div className="assistant-lp-preview">
      <div className="assistant-lp-preview-head">
        <div className="flex min-w-0 items-center gap-2">
          <span className="type-caption-strong truncate text-[var(--ink)]">{artifact.name}</span>
          <StatusBadge status={artifact.status} />
        </div>
        <SegmentedControl
          value={device}
          onChange={setDevice}
          options={[
            { value: "desktop", label: "Computador" },
            { value: "mobile", label: "Celular" },
          ]}
          aria-label="Tamanho da prévia"
        />
      </div>
      <PreviewFrame src={artifact.previewUrl} title={`Prévia de ${artifact.name}`} device={device} />
      <div className="assistant-lp-preview-actions">
        <a href={artifact.previewUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "outline", size: "toolbar" })}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Abrir em nova aba
        </a>
        {artifact.formId || artifact.hasCheckout ? (
          <Button
            type="button"
            size="toolbar"
            variant="outline"
            disabled={!ctx.onAsk}
            onClick={() =>
              ctx.onAsk?.(
                `Teste ${artifact.formId ? "o formulário" : "o checkout"} da landing page "${artifact.name}" e me mostre o resultado.`,
              )
            }
          >
            Testar {artifact.formId ? "formulário" : "checkout"}
          </Button>
        ) : null}
        <Link href={artifact.editPath} className={buttonClass({ variant: "outline", size: "toolbar" })}>
          Abrir no Criar
        </Link>
        {published ? (
          <a href={artifact.publicUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: "toolbar" })}>
            Ver página no ar
          </a>
        ) : (
          <Button type="button" size="toolbar" disabled={busy || !ctx.messageId} onClick={() => void publish()}>
            {busy ? "Publicando…" : "Publicar"}
          </Button>
        )}
      </div>
      {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
      {!published ? (
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          Prévia em modo teste: envios aqui não viram leads nem pedidos de verdade.
        </p>
      ) : null}
    </div>
  );
}

function FormPreviewCard({ artifact, ctx }: { artifact: FormPreviewArtifact; ctx: Ctx }) {
  const { busy, error, publish } = usePublish(ctx, artifact);
  const published = artifact.status === "PUBLISHED";
  return (
    <div className="assistant-lp-preview">
      <div className="assistant-lp-preview-head">
        <div className="flex min-w-0 items-center gap-2">
          <span className="type-caption-strong truncate text-[var(--ink)]">{artifact.name}</span>
          <StatusBadge status={artifact.status} />
        </div>
        <span className="type-fine-print text-[var(--ink-muted-48)]">
          {artifact.fields.length} pergunta{artifact.fields.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="assistant-lp-preview-frame" data-device="form" style={{ height: 520 }}>
        <iframe src={artifact.previewUrl} title={`Prévia de ${artifact.name}`} loading="lazy" />
      </div>
      <div className="assistant-lp-preview-actions">
        <a href={artifact.previewUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "outline", size: "toolbar" })}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Abrir em nova aba
        </a>
        <Button
          type="button"
          size="toolbar"
          variant="outline"
          disabled={!ctx.onAsk}
          onClick={() => ctx.onAsk?.(`Teste o formulário "${artifact.name}" e me mostre o resultado.`)}
        >
          Testar formulário
        </Button>
        {published ? (
          <a href={artifact.publicUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: "toolbar" })}>
            Ver formulário no ar
          </a>
        ) : (
          <Button type="button" size="toolbar" disabled={busy || !ctx.messageId} onClick={() => void publish()}>
            {busy ? "Publicando…" : "Publicar"}
          </Button>
        )}
      </div>
      {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

function TestResultCard({ artifact }: { artifact: TestResultArtifact }) {
  const submitted = Object.entries(artifact.submitted ?? {});
  return (
    <div className="assistant-test-card" data-ok={artifact.ok || undefined}>
      <div className="flex items-center justify-between gap-3">
        <span className="type-caption-strong text-[var(--ink)]">{artifact.title}</span>
        <span className="assistant-status-badge type-fine-print" data-status={artifact.ok ? "PUBLISHED" : "FAILED"}>
          {artifact.ok ? "Passou" : "Falhou"}
        </span>
      </div>
      <ul className="assistant-test-steps">
        {artifact.steps.map((s, i) => (
          <li key={i} className="assistant-test-step" data-ok={s.ok || undefined}>
            <span className="assistant-test-icon" aria-hidden>
              {s.ok ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
            </span>
            <span className="min-w-0">
              <span className="type-caption block text-[var(--ink)]">{s.label}</span>
              {s.detail ? <span className="type-fine-print block text-[var(--ink-muted-48)]">{s.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {submitted.length ? (
        <dl className="assistant-action-preview">
          {submitted.map(([k, v]) => (
            <div key={k} className="assistant-action-row">
              <dt className="type-fine-print text-[var(--ink-muted-48)]">{k}</dt>
              <dd className="type-caption text-[var(--ink)]">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function ResourceCreatedRow({ artifact }: { artifact: ResourceCreatedArtifact }) {
  const what = artifact.resource === "form" ? "Formulário" : artifact.resource === "product" ? "Produto" : "Landing page";
  return (
    <div className="assistant-resource-row">
      <span className="assistant-test-icon" data-ok aria-hidden>
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
      <span className="type-caption min-w-0 flex-1 truncate text-[var(--ink)]">
        {what} <strong className="font-semibold">{artifact.name}</strong>{" "}
        {artifact.status === "PUBLISHED" ? "publicado" : "salvo como rascunho"}
      </span>
      {artifact.editPath ? (
        <Link href={artifact.editPath} className="type-caption text-[var(--primary)]">
          Abrir
        </Link>
      ) : null}
    </div>
  );
}

export function ArtifactList({ artifacts, ...ctx }: Ctx & { artifacts: Artifact[] | undefined }) {
  if (!artifacts?.length) return null;
  const previewed = new Set(
    artifacts.flatMap((a) => (a.kind === "lp_preview" ? [a.productId] : a.kind === "form_preview" ? [a.formId] : [])),
  );
  return (
    <div className="assistant-artifacts">
      {artifacts.map((a) => {
        switch (a.kind) {
          case "chart":
            return <ChartCard key={a.id} chart={a} />;
          case "references":
            return <ReferencesCard key={a.id} artifact={a} />;
          case "lp_preview":
            return <LpPreviewCard key={a.id} artifact={a} ctx={ctx} />;
          case "form_preview":
            return <FormPreviewCard key={a.id} artifact={a} ctx={ctx} />;
          case "test_result":
            return <TestResultCard key={a.id} artifact={a} />;
          case "resource_created":
            return previewed.has(a.resourceId) ? null : <ResourceCreatedRow key={a.id} artifact={a} />;
        }
      })}
    </div>
  );
}
