"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { PillSelect } from "@/components/ui/pill-select";

type Mode = "manual" | "ai";
type Product = { id: string; name: string };

function UpsellInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: Mode | null =
    modeParam === "manual" || modeParam === "ai" ? modeParam : null;
  const via = mode === "ai" ? "assistente" : "manual";

  const [brief, setBrief] = useState("");
  const [triggerId, setTriggerId] = useState("");
  const [offeredId, setOfferedId] = useState("");
  const [offerType, setOfferType] = useState("ORDER_BUMP");
  const [discount, setDiscount] = useState("10");
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

  const { data: commerce, isLoading } = useQuery({
    queryKey: ["commerce-upsell", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ products: Product[] }>;
    },
    enabled: Boolean(workspaceId),
  });
  const products = commerce?.products ?? [];

  function applyAi() {
    const text = brief.trim().toLowerCase();
    if (text.includes("pós") || text.includes("pos-compra") || text.includes("depois")) {
      setOfferType("POST_PURCHASE");
    } else {
      setOfferType("ORDER_BUMP");
    }
    const pct = text.match(/(\d+)\s*%/);
    if (pct) setDiscount(pct[1]);
    if (products.length >= 2) {
      setTriggerId(products[0].id);
      setOfferedId(products[1].id);
    }
    setEditing(true);
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) {
      setError("Crie uma empresa em Config antes de publicar.");
      return;
    }
    if (!triggerId || !offeredId) {
      setError("Escolha o produto gatilho e o ofertado.");
      return;
    }
    if (triggerId === offeredId) {
      setError("Escolha produtos diferentes.");
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
          action: "offer",
          triggerProductId: triggerId,
          offeredProductId: offeredId,
          type: offerType,
          discountPercent: Math.max(0, Math.min(100, Number(discount) || 0)),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível criar a oferta.");
      const label =
        offerType === "POST_PURCHASE" ? "Upsell pós-compra" : "Order bump";
      router.push(
        `/criar/sucesso?kind=upsell&id=${encodeURIComponent(j.offer?.id || "")}&name=${encodeURIComponent(label)}`,
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
      title="Upsell"
      narrow
      actions={
        <BackLink href={via === "assistente" ? "/criar?assistente=1" : "/criar/oferta?mode=manual"} />
      }
    >
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        Criar · {via === "assistente" ? "Assistente" : "Manual"} · Loja · Upsell
      </p>

      {mode === "ai" && !editing ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">
              Descreva o upsell
            </span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="Ex.: Order bump 20% no checkout oferecendo o kit…"
              className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={applyAi}
              disabled={!brief.trim() || isLoading}
            >
              Gerar estrutura
            </Button>
            <BackLink href={via === "assistente" ? "/criar?assistente=1" : "/criar/oferta?mode=manual"} />
          </div>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={publish} className="mt-4 space-y-4">
          {products.length < 2 ? (
            <p className="type-caption text-[var(--ink-muted-80)]">
              Publique pelo menos duas ofertas em{" "}
              <Link href={`/criar/oferta?mode=${mode}`} className="text-[var(--primary)]">
                Criar → Oferta
              </Link>{" "}
              para montar um upsell.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  Produto gatilho
                </span>
                <PillSelect
                  className="mt-1 w-full"
                  size="field"
                  value={triggerId}
                  onChange={setTriggerId}
                  options={[
                    { value: "", label: "Selecionar…" },
                    ...products.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  aria-label="Produto gatilho"
                />
              </label>
              <label className="block">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  Produto ofertado
                </span>
                <PillSelect
                  className="mt-1 w-full"
                  size="field"
                  value={offeredId}
                  onChange={setOfferedId}
                  options={[
                    { value: "", label: "Selecionar…" },
                    ...products.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                  aria-label="Produto ofertado"
                />
              </label>
              <label className="block">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">Tipo</span>
                <PillSelect
                  className="mt-1 w-full"
                  size="field"
                  value={offerType}
                  onChange={setOfferType}
                  options={[
                    { value: "ORDER_BUMP", label: "Oferta no checkout" },
                    { value: "POST_PURCHASE", label: "Pós-compra" },
                  ]}
                  aria-label="Tipo"
                />
              </label>
              <label className="block max-w-[140px]">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">Desconto %</span>
                <input
                  className="mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  inputMode="numeric"
                />
              </label>
            </>
          )}
          {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !workspaceId || products.length < 2}
            >
              {saving ? "Criando…" : "Criar upsell"}
            </Button>
            <BackLink href={via === "assistente" ? "/criar?assistente=1" : "/criar/oferta?mode=manual"} />
          </div>
        </form>
      ) : null}
    </AppPage>
  );
}

export default function CriarUpsellPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <UpsellInner />
    </Suspense>
  );
}
