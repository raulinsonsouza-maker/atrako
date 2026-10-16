"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FormField, FormStep } from "@atrako/forms";
import { collectClientAttribution } from "@/lib/criar/lp-attribution";
import { FormFieldControl, isFieldValueValid } from "@/components/forms/FormFieldControl";

function formPresentation(name: string, layout: "block" | "wizard", slug: string) {
  const cleaned = name.replace(/\s*[—–-]\s*(LP|Qualificação|Qualify)\s*$/i, "").trim() || name;
  const brand = cleaned.replace(/^Franquia\s+/i, "").trim() || cleaned;
  if (layout === "block" || /lp/i.test(slug)) {
    return {
      brand: cleaned.startsWith("Franquia") ? cleaned : `Franquia ${brand}`,
      title: "Fale com a equipe",
      lead: "Deixe seus dados. Em poucos minutos a gente continua no WhatsApp.",
    };
  }
  return {
    brand: cleaned.startsWith("Franquia") ? cleaned : `Franquia ${brand}`,
    title: null as string | null,
    lead: null as string | null,
  };
}

export default function PublicFormPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<FormStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const preview = new URLSearchParams(window.location.search).get("preview");
    setPreviewToken(preview);
    (async () => {
      try {
        const r = await fetch(
          preview
            ? `/api/atrako/forms?preview=${encodeURIComponent(preview)}`
            : `/api/atrako/forms?slug=${encodeURIComponent(slug)}`,
        );
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Formulário não encontrado");
        if (cancelled) return;
        setName(j.form.name);
        setSteps((j.form.steps as FormStep[]) ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const currentStep = steps[stepIdx];
  const fields = currentStep?.fields ?? [];
  const layout: "block" | "wizard" =
    steps.length === 1 && (steps[0]?.fields?.length ?? 0) > 1 ? "block" : "wizard";
  const progress = steps.length
    ? Math.round(((stepIdx + 1) / steps.length) * 100)
    : 0;
  const copy = formPresentation(name, layout, slug);

  const canNext = useMemo(() => {
    if (!fields.length) return false;
    return fields.every((f) => isFieldValueValid(f, answers[f.id] ?? "", answers));
  }, [fields, answers]);

  function setField(field: FormField, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [field.id]: value };
      if (field.type === "state") {
        for (const step of steps) {
          for (const f of step.fields) {
            if (f.type === "city" && (f.dependsOn || "state") === field.id) next[f.id] = "";
          }
        }
      }
      return next;
    });
  }

  async function finish(finalAnswers: Record<string, string>) {
    setSubmitting(true);
    try {
      const payload = Object.entries(finalAnswers).map(([fieldId, val]) => ({
        fieldId,
        value: val,
      }));
      const r = await fetch("/api/atrako/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          slug,
          answers: payload,
          ...collectClientAttribution({ formSlug: slug }),
          ...(previewToken ? { preview: previewToken } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha ao enviar");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setSubmitting(false);
    }
  }

  function onNext(e: React.FormEvent) {
    e.preventDefault();
    if (!canNext) return;
    if (stepIdx >= steps.length - 1) {
      void finish(answers);
    } else {
      setStepIdx((s) => s + 1);
    }
  }

  if (loading) {
    return (
      <div className="capture-form-done">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error && !steps.length) {
    return (
      <div className="capture-form-done">
        <p className="type-body">{error}</p>
      </div>
    );
  }

  if (done) {
    const first =
      (answers.name || answers.nome || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0] || "";
    const isQualify = /qualify/i.test(slug);
    return (
      <div className="capture-form-done">
        <h1 className="type-display-md">
          {previewToken ? "Teste ok" : first ? `Pronto, ${first}` : "Tudo certo"}
        </h1>
        <p className="type-body">
          {previewToken
            ? "As respostas passaram na validação. Neste modo de teste nada foi salvo."
            : isQualify
              ? "Suas respostas já estão com a equipe de expansão. Vamos te chamar no WhatsApp para o próximo passo."
              : "Cadastro feito. Vamos te chamar no WhatsApp em breve para continuar."}
        </p>
      </div>
    );
  }

  const last = stepIdx >= steps.length - 1;
  const wizardQuestion =
    fields[0]?.type === "consent" ? "Para continuar" : fields[0]?.label || currentStep?.title || "";

  const progressPct = Math.min(100, progress);

  return (
    <div className={`capture-form-page ${layout === "wizard" ? "capture-form-wizard" : ""}`}>
      {layout === "block" ? (
        <div className="capture-form-progress" aria-hidden>
          <div className="capture-form-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
      ) : null}

      <div className="capture-form-center">
        {layout === "block" ? (
          <div className="capture-form-card">
            <p className="capture-form-brand type-fine-print">
              {copy.brand}
              {previewToken ? " · Modo teste" : ""}
            </p>
            <h1 className="capture-form-title type-tagline">{copy.title}</h1>
            {copy.lead ? <p className="capture-form-lead type-body">{copy.lead}</p> : null}

            <form onSubmit={onNext}>
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
              </div>
              {error ? <p className="mt-3 type-caption text-[var(--danger)]">{error}</p> : null}
              <div className="capture-form-actions">
                <Button type="submit" variant="store-hero" className="w-full" disabled={!canNext || submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={onNext}>
            <p className="capture-form-wizard-step type-fine-print">
              {copy.brand}
              {previewToken ? " · Modo teste" : ""}
            </p>
            <div
              className="capture-form-track"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso"
            >
              <div className="capture-form-track-bar" style={{ width: `${progressPct}%` }} />
            </div>
            <h1 className="capture-form-wizard-q type-display-md">{wizardQuestion}</h1>
            {fields.map((f, i) => (
              <FormFieldControl
                key={f.id}
                field={f.type === "consent" ? f : { ...f, label: f.label }}
                value={answers[f.id] ?? ""}
                answers={answers}
                onChange={(v) => setField(f, v)}
                variant="wizard"
                hideLabel={f.type !== "consent" && f.type !== "state" && f.type !== "city"}
                autoFocus={i === 0 && (f.type === "text" || f.type === "email" || f.type === "phone")}
              />
            ))}
            {error ? <p className="mt-3 type-caption text-[var(--danger)]">{error}</p> : null}
            <div className="capture-form-actions">
              <Button type="submit" variant="store-hero" className="w-full" disabled={!canNext || submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : last ? (
                  "Enviar"
                ) : (
                  "Continuar"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
