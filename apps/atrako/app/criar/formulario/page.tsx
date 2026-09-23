"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { PillSelect } from "@/components/ui/pill-select";
import { UrlPreview } from "@/components/criar/CopyLinkButton";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { slugify } from "@/lib/criar/slug";
import type { FormField, FormFieldType, FormStep } from "@atrako/forms";

const fieldClass =
  "mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

type Mode = "manual" | "ai";

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "choice", label: "Escolha" },
];

function newField(partial?: Partial<FormField>): FormField {
  return {
    id: `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    type: "text",
    label: "Pergunta",
    required: true,
    ...partial,
  };
}

function FormularioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: Mode | null =
    modeParam === "manual" || modeParam === "ai" ? modeParam : null;
  const via = mode === "ai" ? "assistente" : "manual";

  const [brief, setBrief] = useState("");
  const [name, setName] = useState("Qualificação");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fields, setFields] = useState<FormField[]>([
    newField({ id: "name", type: "text", label: "Nome" }),
    newField({ id: "email", type: "email", label: "E-mail" }),
    newField({ id: "phone", type: "phone", label: "WhatsApp" }),
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(mode === "manual");

  useEffect(() => {
    if (!mode) router.replace("/criar/p/captura");
  }, [mode, router]);

  const { workspaceId } = useActiveWorkspace();

  const autoSlug = useMemo(() => slugify(name || "formulario"), [name]);
  const effectiveSlug = slugTouched && slug ? slugify(slug) : autoSlug;
  const path = `/f/${effectiveSlug}`;

  async function applyAi() {
    if (!workspaceId || !brief.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "brief",
          brief: brief.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao gerar");
      const form = j.form as { name: string; steps: FormStep[] };
      setName(form.name || brief.slice(0, 80));
      const flat = form.steps.flatMap((s) => s.fields);
      if (flat.length) setFields(flat);
      setEditing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) {
      setError("Crie uma empresa em Config antes de publicar.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const steps: FormStep[] = [
        {
          id: "step_1",
          title: name.trim() || "Formulário",
          fields: fields.map((f) => ({
            ...f,
            label: f.label.trim() || "Pergunta",
          })),
        },
      ];
      const r = await fetch("/api/atrako/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "publish",
          name: name.trim(),
          slug: effectiveSlug,
          steps,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível publicar.");
      const publishedSlug = j.form?.slug || effectiveSlug;
      router.push(
        `/criar/sucesso?kind=formulario&slug=${encodeURIComponent(publishedSlug)}&id=${encodeURIComponent(j.form?.id || "")}&name=${encodeURIComponent(name.trim())}`,
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
      title="Formulário"
      narrow
      actions={
        <BackLink href={via === "assistente" ? "/criar/p/captura?mode=ai" : "/criar/p/captura"} />
      }
    >
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        Criar · {via === "assistente" ? "Assistente" : "Manual"} · Formulário · Publicar
      </p>

      {mode === "ai" && !editing ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Descreva o formulário</span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder="Ex.: Qualificar clínicas que querem tráfego pago…"
              className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              autoFocus
            />
          </label>
          {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void applyAi()}
              disabled={saving || !brief.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Gerar estrutura
            </Button>
            <BackLink href={via === "assistente" ? "/criar/p/captura?mode=ai" : "/criar/p/captura"} />
          </div>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={publish} className="mt-4 space-y-4">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Nome</span>
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Slug da URL</span>
            <input
              className={fieldClass}
              value={slugTouched ? slug : effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </label>
          <div>
            <p className="mb-1.5 type-micro-legal text-[var(--ink-muted-48)]">URL pública</p>
            <UrlPreview path={path} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="type-caption-strong text-[var(--ink)]">Perguntas</p>
              <button
                type="button"
                onClick={() => setFields((f) => [...f, newField()])}
                className="inline-flex items-center gap-1 type-caption text-[var(--primary)] active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className="space-y-2 rounded-lg border border-[var(--hairline)] bg-[var(--canvas)] p-3"
              >
                <div className="flex items-start gap-2">
                  <input
                    className={`${fieldClass} !mt-0`}
                    value={field.label}
                    onChange={(e) =>
                      setFields((all) =>
                        all.map((f, i) => (i === idx ? { ...f, label: e.target.value } : f)),
                      )
                    }
                    placeholder="Pergunta"
                  />
                  <button
                    type="button"
                    onClick={() => setFields((all) => all.filter((_, i) => i !== idx))}
                    className="mt-2 shrink-0 text-[var(--ink-muted-48)] active:scale-95"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <PillSelect
                  size="field"
                  aria-label="Tipo da pergunta"
                  value={field.type}
                  onChange={(v) =>
                    setFields((all) =>
                      all.map((f, i) =>
                        i === idx ? { ...f, type: v as FormFieldType } : f,
                      ),
                    )
                  }
                  options={FIELD_TYPES}
                />
                {field.type === "choice" ? (
                  <input
                    className={fieldClass}
                    placeholder="Opções separadas por vírgula"
                    value={(field.options ?? []).join(", ")}
                    onChange={(e) =>
                      setFields((all) =>
                        all.map((f, i) =>
                          i === idx
                            ? {
                                ...f,
                                options: e.target.value
                                  .split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              }
                            : f,
                        ),
                      )
                    }
                  />
                ) : null}
              </div>
            ))}
          </div>

          {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={saving || !workspaceId || !fields.length}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Publicando…" : "Publicar"}
            </Button>
            <BackLink href={via === "assistente" ? "/criar/p/captura?mode=ai" : "/criar/p/captura"} />
          </div>
        </form>
      ) : null}
    </AppPage>
  );
}

export default function CriarFormularioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <FormularioInner />
    </Suspense>
  );
}
