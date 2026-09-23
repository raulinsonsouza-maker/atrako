"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

const fieldClass =
  "mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

type Mode = "manual" | "ai";

function ServicoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: Mode | null =
    modeParam === "manual" || modeParam === "ai" ? modeParam : null;
  const via = mode === "ai" ? "assistente" : "manual";

  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(mode === "manual");

  useEffect(() => {
    if (!mode) router.replace("/criar/p/agenda");
  }, [mode, router]);

  const { workspaceId, workspaces } = useActiveWorkspace();
  const workspaceSlug = workspaces.find((w) => w.id === workspaceId)?.slug;

  function applyAi() {
    const text = brief.trim();
    if (!text) return;
    const firstLine = text.split(/\n/)[0].slice(0, 80);
    setTitle(firstLine);
    const mins = text.match(/(\d+)\s*min/i);
    if (mins) setDuration(mins[1]);
    const money = text.match(/R\$\s*([\d.,]+)/i) || text.match(/(\d+[.,]\d{2})/);
    if (money) setPrice(money[1].replace(".", ","));
    else if (!price) setPrice("150");
    setEditing(true);
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) {
      setError("Crie uma empresa em Config antes de publicar.");
      return;
    }
    if (!title.trim()) {
      setError("Informe o nome do serviço.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const priceCents = Math.round(Number(price.replace(",", ".")) * 100) || 0;
      const durationMinutes = Math.max(15, Number(duration) || 60);
      const r = await fetch("/api/atrako/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "service",
          title: title.trim(),
          durationMinutes,
          priceCents,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível publicar.");
      const slug = workspaceSlug || "";
      router.push(
        `/criar/sucesso?kind=servico&slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(j.service?.id || "")}&name=${encodeURIComponent(title.trim())}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao publicar");
    } finally {
      setSaving(false);
    }
  }

  if (!mode) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <AppPage
      title="Serviço"
      narrow
      actions={
        <BackLink href={via === "assistente" ? "/criar/p/agenda?mode=ai" : "/criar/p/agenda"} />
      }
    >
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        Criar · {via === "assistente" ? "Assistente" : "Manual"} · Agenda · Publicar
      </p>

      {mode === "ai" && !editing ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">
              Descreva o serviço
            </span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder="Ex.: Consulta inicial 45 min, R$ 180…"
              className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="primary" onClick={applyAi} disabled={!brief.trim()}>
              Gerar estrutura
            </Button>
            <BackLink href={via === "assistente" ? "/criar/p/agenda?mode=ai" : "/criar/p/agenda"} />
          </div>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={publish} className="mt-4 space-y-4">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Nome</span>
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Consulta, corte, sessão"
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="type-micro-legal text-[var(--ink-muted-48)]">Duração (min)</span>
              <input
                className={fieldClass}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block">
              <span className="type-micro-legal text-[var(--ink-muted-48)]">Preço (R$)</span>
              <input
                className={fieldClass}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </label>
          </div>
          {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={saving || !workspaceId}>
              {saving ? "Publicando…" : "Publicar serviço"}
            </Button>
            <BackLink href={via === "assistente" ? "/criar/p/agenda?mode=ai" : "/criar/p/agenda"} />
          </div>
        </form>
      ) : null}
    </AppPage>
  );
}

export default function CriarServicoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <ServicoInner />
    </Suspense>
  );
}
