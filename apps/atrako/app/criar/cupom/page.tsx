"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";

const fieldClass =
  "mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

type Mode = "manual" | "ai";

function CupomInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: Mode | null =
    modeParam === "manual" || modeParam === "ai" ? modeParam : null;
  const via = mode === "ai" ? "assistente" : "manual";

  const [brief, setBrief] = useState("");
  const [code, setCode] = useState("");
  const [value, setValue] = useState("10");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(mode === "manual");

  useEffect(() => {
    if (!mode) router.replace("/criar/oferta?mode=manual");
  }, [mode, router]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["config-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });
  const workspaceId = clientes[0]?.id as string | undefined;

  function applyAi() {
    const text = brief.trim();
    if (!text) return;
    const pct = text.match(/(\d+)\s*%/);
    if (pct) setValue(pct[1]);
    const codeMatch = text.match(/\b([A-Z0-9]{4,16})\b/);
    const words = text
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 2)
      .join("");
    setCode(codeMatch?.[1] || words.slice(0, 12) || "BEMVINDO10");
    setEditing(true);
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) {
      setError("Crie uma empresa em Config antes de publicar.");
      return;
    }
    if (!code.trim()) {
      setError("Informe o código do cupom.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/commerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "coupon",
          code: code.trim().toUpperCase(),
          type: "PERCENT",
          value: Math.max(1, Math.min(100, Number(value) || 10)),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível criar o cupom.");
      router.push(
        `/criar/sucesso?kind=cupom&slug=${encodeURIComponent(code.trim().toUpperCase())}&id=${encodeURIComponent(j.coupon?.id || "")}&name=${encodeURIComponent(code.trim().toUpperCase())}`,
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
      title="Cupom"
      narrow
      actions={
        <BackLink href={via === "assistente" ? "/criar?assistente=1" : "/criar/oferta?mode=manual"} />
      }
    >
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        Criar · {via === "assistente" ? "Assistente" : "Manual"} · Loja · Cupom
      </p>

      {mode === "ai" && !editing ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">
              Descreva o cupom
            </span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Ex.: 15% off no lançamento, código LANCA15…"
              className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="primary" onClick={applyAi} disabled={!brief.trim()}>
              Gerar estrutura
            </Button>
            <BackLink href={via === "assistente" ? "/criar?assistente=1" : "/criar/oferta?mode=manual"} />
          </div>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={publish} className="mt-4 space-y-4">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Código</span>
            <input
              className={fieldClass}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="EX: BEMVINDO10"
              required
            />
          </label>
          <label className="block max-w-[140px]">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">% off</span>
            <input
              className={fieldClass}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="numeric"
            />
          </label>
          {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={saving || !workspaceId}>
              {saving ? "Criando…" : "Criar cupom"}
            </Button>
            <BackLink href={via === "assistente" ? "/criar?assistente=1" : "/criar/oferta?mode=manual"} />
          </div>
        </form>
      ) : null}
    </AppPage>
  );
}

export default function CriarCupomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CupomInner />
    </Suspense>
  );
}
