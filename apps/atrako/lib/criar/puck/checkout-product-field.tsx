"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PillSelect } from "@/components/ui/pill-select";
import {
  COMMERCE_PRODUCT_TYPE_LABELS,
  COMMERCE_PRODUCT_TYPES,
} from "@/lib/criar/lp-schema";
import { useLpPuckCtx } from "@/lib/criar/puck/context";
import { slugify } from "@/lib/criar/slug";

function CheckoutProductField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ctx = useLpPuckCtx();
  const catalog = ctx.checkoutCatalog ?? [];
  const workspaceId = ctx.product.clienteId;

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<string>("FILE");

  const options = [
    { value: "", label: "Escolha o que cobrar" },
    ...catalog.map((p) => ({
      value: p.id,
      label: `${p.name} · ${(p.priceCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}`,
    })),
  ];

  const typeOptions = COMMERCE_PRODUCT_TYPES.map((t) => ({
    value: t,
    label: COMMERCE_PRODUCT_TYPE_LABELS[t],
  }));

  async function createCheckout() {
    if (!workspaceId) {
      setError("Workspace indisponível.");
      return;
    }
    const n = name.trim();
    const cents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!n || !Number.isFinite(cents) || cents <= 0) {
      setError("Informe nome e preço.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/commerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "product",
          name: n,
          slug: `${slugify(n)}-${Date.now().toString(36).slice(-4)}`,
          priceCents: cents,
          type: type || "FILE",
          status: "PUBLISHED",
        }),
      });
      const j = (await r.json()) as {
        error?: string;
        product?: {
          id: string;
          name: string;
          slug: string;
          priceCents: number;
          type?: string;
          description?: string | null;
        };
      };
      if (!r.ok) throw new Error(j.error || "Não foi possível criar o checkout.");
      const p = j.product;
      if (!p?.id) throw new Error("Checkout sem id.");
      const item = {
        id: p.id,
        name: p.name,
        slug: p.slug,
        priceCents: p.priceCents,
        description: p.description ?? null,
        clienteId: workspaceId,
        type: p.type,
      };
      ctx.onCheckoutCreated?.(item);
      onChange(p.id);
      setCreating(false);
      setName("");
      setPrice("");
      setType("FILE");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <PillSelect
        size="field"
        value={value || ""}
        onChange={onChange}
        options={options}
        aria-label="O que cobrar"
      />
      <button
        type="button"
        className="type-fine-print text-[var(--primary)]"
        onClick={() => setCreating((v) => !v)}
      >
        {creating ? "Cancelar" : "Criar checkout"}
      </button>
      {creating ? (
        <div className="space-y-2 rounded-[var(--radius-xs)] border border-[var(--hairline)] p-2">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">
              Nome
            </span>
            <input
              className="mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Mentoria 30 dias"
            />
          </label>
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">
              Preço (R$)
            </span>
            <input
              className="mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="97"
              inputMode="decimal"
            />
          </label>
          <div>
            <span className="type-micro-legal text-[var(--ink-muted-48)]">
              Tipo
            </span>
            <div className="mt-1">
              <PillSelect
                size="field"
                value={type}
                onChange={setType}
                options={typeOptions}
                aria-label="Tipo do checkout"
              />
            </div>
          </div>
          {error ? (
            <p className="type-micro-legal text-[var(--danger)]">{error}</p>
          ) : null}
          <button
            type="button"
            className="lp-pages-btn-secondary w-full"
            disabled={busy}
            onClick={() => void createCheckout()}
          >
            {busy ? (
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            ) : null}
            Salvar checkout
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function checkoutProductField(label = "O que cobrar") {
  return {
    type: "custom" as const,
    label,
    render: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (v: string) => void;
    }) => (
      <CheckoutProductField
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    ),
  };
}
