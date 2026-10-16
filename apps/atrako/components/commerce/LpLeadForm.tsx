"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { FormField } from "@atrako/forms";
import { Button } from "@/components/ui/button";
import { collectClientAttribution } from "@/lib/criar/lp-attribution";
import { FormFieldControl, isFieldValueValid } from "@/components/forms/FormFieldControl";

type Props = {
  /** Se houver form publicado, completa via slug */
  formSlug?: string | null;
  /** Campos reais do CaptureForm vinculado; sem isso, nome/e-mail/WhatsApp. */
  fields?: FormField[] | null;
  title?: string;
  submitLabel?: string;
  workspaceId?: string;
  productId?: string;
  pageSlug?: string;
  className?: string;
  /** Modo teste (prévia): o servidor valida e não grava nada. */
  previewToken?: string | null;
};

const DEFAULT_FIELDS: FormField[] = [
  { id: "nome", type: "text", label: "Nome", required: true },
  { id: "email", type: "email", label: "E-mail", required: true },
  { id: "telefone", type: "phone", label: "WhatsApp", required: false },
];

/** Form de captura Atrako (CRM) — usado na LP de leads (layout em bloco). */
export function LpLeadForm({
  formSlug,
  fields,
  title = "Deixe seus dados",
  submitLabel = "Enviar",
  workspaceId,
  productId,
  pageSlug,
  className,
  previewToken,
}: Props) {
  const list = fields?.length ? fields : DEFAULT_FIELDS;
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(field: FormField, v: string) {
    setValues((cur) => {
      const next = { ...cur, [field.id]: v };
      if (field.type === "state") {
        for (const f of list) {
          if (f.type === "city" && (f.dependsOn || "state") === field.id) next[f.id] = "";
        }
      }
      return next;
    });
  }

  const canSubmit = useMemo(
    () => list.every((f) => isFieldValueValid(f, values[f.id] ?? "", values)),
    [list, values],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const attribution = collectClientAttribution({ productId, pageSlug, formSlug });
      const answers = list.map((f) => ({ fieldId: f.id, value: (values[f.id] ?? "").trim() }));
      const usesForm = Boolean(formSlug || (previewToken && fields?.length));
      const body = usesForm
        ? { action: "complete", slug: formSlug ?? "", answers, ...attribution }
        : {
            action: "lp_lead",
            workspaceId,
            nome: (values.nome ?? "").trim(),
            email: (values.email ?? "").trim(),
            telefone: (values.telefone ?? "").trim() || undefined,
            ...attribution,
          };
      const r = await fetch("/api/atrako/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(previewToken ? { ...body, preview: previewToken } : body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível enviar");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={className}>
        <div className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] p-6 text-center">
          <p className="type-caption-strong text-[var(--ink)]">{previewToken ? "Teste enviado" : "Recebido"}</p>
          <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
            {previewToken
              ? "Modo teste: as respostas foram validadas e nada foi salvo."
              : "Em breve você recebe o próximo passo no e-mail."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={`rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] p-5 sm:p-6 ${className ?? ""}`}
    >
      {title ? <h3 className="type-caption-strong text-[var(--ink)]">{title}</h3> : null}
      <div className={title ? "mt-4 space-y-3" : "space-y-3"}>
        {list.map((f) => (
          <label key={f.id} className="block">
            {f.type !== "consent" ? (
              <span className="type-micro-legal text-[var(--ink-muted-48)]">
                {f.label}
                {f.required ? "" : " (opcional)"}
              </span>
            ) : null}
            <FormFieldControl
              field={f}
              value={values[f.id] ?? ""}
              answers={values}
              onChange={(v) => setField(f, v)}
              variant="block"
            />
          </label>
        ))}
      </div>
      {error ? <p className="mt-3 type-caption text-[var(--danger)]">{error}</p> : null}
      <Button type="submit" variant="primary" className="mt-5 w-full" disabled={loading || !canSubmit}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Enviando…" : submitLabel}
      </Button>
      {previewToken ? (
        <p className="mt-3 text-center type-fine-print text-[var(--ink-muted-48)]">Modo teste — nada será salvo.</p>
      ) : null}
    </form>
  );
}
