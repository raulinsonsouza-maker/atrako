"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PillSelect } from "@/components/ui/pill-select";
import { useLpPuckCtx } from "@/lib/criar/puck/context";
import { slugify } from "@/lib/criar/slug";

function FormSelectField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ctx = useLpPuckCtx();
  const catalog = ctx.formCatalog ?? [];
  const workspaceId = ctx.product.clienteId;

  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const options = [
    { value: "", label: "Escolha um formulário" },
    ...catalog.map((f) => ({
      value: f.id,
      label: f.name || f.slug,
    })),
  ];

  async function createForm() {
    if (!workspaceId) {
      setError("Workspace indisponível.");
      return;
    }
    const n = name.trim() || "Formulário da página";
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "publish",
          name: n,
          slug: `${slugify(n)}-${Date.now().toString(36).slice(-4)}`,
          steps: [
            {
              id: "step_1",
              title: n,
              fields: [
                {
                  id: "name",
                  type: "text",
                  label: "Nome",
                  required: true,
                },
                {
                  id: "email",
                  type: "email",
                  label: "E-mail",
                  required: true,
                },
                {
                  id: "phone",
                  type: "phone",
                  label: "WhatsApp",
                  required: true,
                },
              ],
            },
          ],
        }),
      });
      const j = (await r.json()) as {
        error?: string;
        form?: { id: string; name?: string; slug: string };
      };
      if (!r.ok) throw new Error(j.error || "Não foi possível criar o formulário.");
      const f = j.form;
      if (!f?.id) throw new Error("Formulário sem id.");
      const item = {
        id: f.id,
        name: f.name || n,
        slug: f.slug,
      };
      ctx.onFormCreated?.(item);
      onChange(f.id);
      setCreating(false);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar formulário");
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
        aria-label="Formulário"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className="type-fine-print text-[var(--primary)]"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Cancelar" : "Criar formulário"}
        </button>
        <Link
          href="/criar/formulario?mode=manual"
          className="type-fine-print text-[var(--ink-muted-48)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          Editor completo
        </Link>
      </div>
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
              placeholder="Ex.: Qualificação"
            />
          </label>
          <p className="type-micro-legal text-[var(--ink-muted-48)]">
            Cria com nome, e-mail e WhatsApp.
          </p>
          {error ? (
            <p className="type-micro-legal text-[var(--danger)]">{error}</p>
          ) : null}
          <button
            type="button"
            className="lp-pages-btn-secondary w-full"
            disabled={busy}
            onClick={() => void createForm()}
          >
            {busy ? (
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            ) : null}
            Salvar formulário
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function formSelectField(label = "Formulário") {
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
      <FormSelectField
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
      />
    ),
  };
}
