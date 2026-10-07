"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { FormField } from "@atrako/forms";
import { Button } from "@/components/ui/button";
import { OptionChip } from "@/components/ui/option-chip";
import { Switch } from "@/components/ui/switch";
import { collectClientAttribution } from "@/lib/criar/lp-attribution";

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

const fieldClass =
  "mt-1.5 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

const DEFAULT_FIELDS: FormField[] = [
  { id: "nome", type: "text", label: "Nome", required: true },
  { id: "email", type: "email", label: "E-mail", required: true },
  { id: "telefone", type: "phone", label: "WhatsApp", required: false },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function maskDate(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length <= 2 ? d : d.length <= 4 ? `${d.slice(0, 2)}/${d.slice(2)}` : `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Form de captura Atrako (CRM) — usado na LP de leads. */
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

  const set = (id: string, v: string) => setValues((cur) => ({ ...cur, [id]: v }));

  const canSubmit = useMemo(
    () =>
      list.every((f) => {
        const v = (values[f.id] ?? "").trim();
        if (!v) return !f.required;
        if (f.type === "email") return EMAIL_RE.test(v);
        if (f.type === "consent") return v === "sim";
        return true;
      }),
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
        {list.map((f) => {
          const v = values[f.id] ?? "";
          const label = (
            <span className="type-micro-legal text-[var(--ink-muted-48)]">
              {f.label}
              {f.required ? "" : " (opcional)"}
            </span>
          );
          if (f.type === "choice" && f.options?.length) {
            return (
              <div key={f.id}>
                {label}
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {f.options.map((opt) => (
                    <OptionChip key={opt} selected={v === opt} onClick={() => set(f.id, opt)}>
                      {opt}
                    </OptionChip>
                  ))}
                </div>
              </div>
            );
          }
          if (f.type === "consent") {
            return (
              <div key={f.id} className="flex items-start gap-3 pt-1">
                <Switch checked={v === "sim"} onChange={(on) => set(f.id, on ? "sim" : "")} aria-label={f.label} />
                <span className="type-fine-print text-[var(--ink-muted-80)]">{f.label}</span>
              </div>
            );
          }
          return (
            <label key={f.id} className="block">
              {label}
              <input
                className={fieldClass}
                type={f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
                inputMode={f.type === "phone" ? "tel" : f.type === "number" || f.type === "date" ? "numeric" : undefined}
                placeholder={f.type === "date" ? "DD/MM" : undefined}
                value={v}
                onChange={(e) => set(f.id, f.type === "date" ? maskDate(e.target.value) : e.target.value)}
                required={Boolean(f.required)}
                autoComplete={
                  f.type === "email" ? "email" : f.type === "phone" ? "tel" : /nome|name/i.test(f.label) ? "name" : undefined
                }
              />
            </label>
          );
        })}
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
