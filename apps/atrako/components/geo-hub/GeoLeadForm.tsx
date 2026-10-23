"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { FormField } from "@atrako/forms";
import { Button, PillSelect } from "@/components/ui";
import { FormFieldControl, isFieldValueValid } from "@/components/forms/FormFieldControl";
import { collectClientAttribution } from "@/lib/criar/lp-attribution";
import { firstTouchPayload } from "@/lib/geo-hub/first-touch";

export type HowFoundOption = { value: string; label: string };

function newEventId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Formulário inline do guia: mesmo CaptureForm da LP + origem declarada + contexto da página. */
export function GeoLeadForm({
  formSlug,
  fields,
  title,
  lead,
  submitLabel,
  brand,
  pageKey,
  pageTitle,
  howFoundOptions,
  howFoundLabel,
}: {
  formSlug: string;
  fields: FormField[];
  title: string;
  lead: string;
  submitLabel: string;
  brand: string;
  pageKey: string;
  pageTitle: string;
  howFoundOptions: HowFoundOption[];
  howFoundLabel: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [howFound, setHowFound] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const valid = useMemo(
    () => fields.every((f) => isFieldValueValid(f, answers[f.id] ?? "", answers)),
    [fields, answers],
  );

  function setField(field: FormField, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [field.id]: value };
      if (field.type === "state") {
        for (const f of fields) if (f.type === "city" && (f.dependsOn || "state") === field.id) next[f.id] = "";
      }
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const metaEventId = newEventId();
    try {
      const payload = Object.entries(answers)
        .filter(([, v]) => v.trim())
        .map(([fieldId, value]) => ({ fieldId, value: fieldId === "phone" ? value.replace(/\D/g, "") : value.trim() }));
      if (howFound) payload.push({ fieldId: "how_found", value: howFound });
      const r = await fetch("/api/atrako/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          slug: formSlug,
          answers: payload,
          metaEventId,
          website,
          startedAt: startedAt.current,
          geoPage: pageKey,
          geoPageTitle: pageTitle,
          ...collectClientAttribution({ formSlug }),
          ...firstTouchPayload(),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || "Não foi possível enviar agora.");
      if (typeof window.fbq === "function") {
        window.fbq("track", "Lead", { content_name: `${brand} · guia`, content_category: pageKey }, { eventID: metaEventId });
      }
      if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { page_key: pageKey });
      const first = (answers.name || "").trim().split(/\s+/)[0];
      setDone(first);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar agora.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done !== null) {
    return (
      <div className="capture-form-card" role="status">
        <p className="capture-form-brand type-fine-print">{brand}</p>
        <h2 className="capture-form-title type-tagline">{done ? `Pronto, ${done}!` : "Pronto!"}</h2>
        <p className="capture-form-lead type-body">
          Recebemos seus dados. A equipe de expansão vai te chamar no WhatsApp para apresentar o modelo e as condições.
        </p>
      </div>
    );
  }

  return (
    <form className="capture-form-card" onSubmit={onSubmit} noValidate>
      <p className="capture-form-brand type-fine-print">{brand}</p>
      <h2 className="capture-form-title type-tagline">{title}</h2>
      <p className="capture-form-lead type-body">{lead}</p>
      <div className="capture-form-fields">
        {fields.map((f) => (
          <FormFieldControl
            key={f.id}
            field={f}
            value={answers[f.id] ?? ""}
            answers={answers}
            onChange={(v) => setField(f, v)}
            variant="block"
          />
        ))}
        {howFoundOptions.length ? (
          <div>
            <span className="capture-form-field-label type-caption-strong">{howFoundLabel} (opcional)</span>
            <PillSelect
              size="field"
              value={howFound}
              onChange={setHowFound}
              options={[{ value: "", label: "Escolha uma opção" }, ...howFoundOptions]}
              aria-label={howFoundLabel}
            />
          </div>
        ) : null}
        <label className="geo-hp" aria-hidden="true">
          Não preencha
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
        </label>
      </div>
      {error ? <p className="mt-3 type-caption text-[var(--danger)]">{error}</p> : null}
      <div className="capture-form-actions">
        <Button type="submit" variant="store-hero" className="w-full" disabled={!valid || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </div>
      <p className="mt-3 type-fine-print text-[var(--ink-muted-48)]">
        A equipe entra em contato pelo WhatsApp e e-mail informados.
      </p>
    </form>
  );
}
