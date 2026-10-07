"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FormField } from "@atrako/forms";

const fieldClass =
  "mt-3 h-12 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

export default function PublicFormPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [step, setStep] = useState(0);
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
        const flat = (j.form.steps as Array<{ fields: FormField[] }>).flatMap((s) => s.fields);
        setFields(flat);
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

  const current = fields[step];
  const progress = fields.length ? Math.round(((step + (done ? 1 : 0)) / fields.length) * 100) : 0;
  const value = current ? answers[current.id] ?? "" : "";

  const canNext = useMemo(() => {
    if (!current) return false;
    const v = value.trim();
    if (v && current.type === "email" && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return false;
    if (v && current.type === "date" && !/^\d{2}\/\d{2}(\/\d{4})?$/.test(v)) return false;
    if (!current.required) return true;
    return v.length > 0;
  }, [current, value]);

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
    if (!current || !canNext) return;
    const nextAnswers = { ...answers, [current.id]: value.trim() };
    setAnswers(nextAnswers);
    if (step >= fields.length - 1) {
      void finish(nextAnswers);
    } else {
      setStep((s) => s + 1);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas-parchment)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error && !fields.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas-parchment)] px-6">
        <p className="type-body text-[var(--ink-muted-80)]">{error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--canvas)] px-6 text-center">
        <h1 className="type-display-md text-[var(--ink)]">{previewToken ? "Teste concluído" : "Obrigado"}</h1>
        <p className="type-body text-[var(--ink-muted-80)]">
          {previewToken
            ? "Modo teste: as respostas passaram na validação e nada foi salvo."
            : "Recebemos suas respostas."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)] text-[var(--ink)]">
      <div className="h-1 w-full bg-[var(--surface-chip-translucent)]">
        <div
          className="h-full bg-[var(--primary)] transition-all"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          {name}
          {previewToken ? " · Modo teste — nada será salvo" : ""}
        </p>
        <form onSubmit={onNext} className="mt-4">
          <h1 className="type-lead text-[var(--ink)]">{current?.label}</h1>
          {current?.type === "consent" ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={value === "sim"}
              onClick={() => setAnswers((a) => ({ ...a, [current.id]: value === "sim" ? "" : "sim" }))}
              className={`mt-6 flex w-full items-start gap-3 rounded-[var(--radius-xs)] border px-5 py-4 text-left type-body active:scale-[0.99] ${
                value === "sim"
                  ? "border-[var(--primary)] bg-[var(--primary-glow)] text-[var(--ink)]"
                  : "border-[var(--hairline)] bg-[var(--canvas)] text-[var(--ink)]"
              }`}
            >
              <span
                className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border ${
                  value === "sim" ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]" : "border-[var(--hairline)]"
                }`}
                aria-hidden
              >
                {value === "sim" ? "✓" : ""}
              </span>
              <span>Aceito receber novidades e ofertas por e-mail e WhatsApp. Posso cancelar quando quiser.</span>
            </button>
          ) : current?.type === "date" ? (
            <input
              autoFocus
              className={fieldClass}
              inputMode="numeric"
              placeholder="DD/MM"
              maxLength={10}
              value={value}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                const masked =
                  digits.length <= 2 ? digits : digits.length <= 4 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                setAnswers((a) => ({ ...a, [current.id]: masked }));
              }}
              required={current?.required}
            />
          ) : current?.type === "choice" && current.options?.length ? (
            <div className="mt-6 flex flex-col gap-2">
              {current.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    setAnswers((a) => ({ ...a, [current.id]: opt }))
                  }
                  className={`rounded-[var(--radius-xs)] border px-5 py-3 text-left type-body active:scale-[0.99] ${
                    value === opt
                      ? "border-[var(--primary)] bg-[var(--primary-glow)] text-[var(--primary)]"
                      : "border-[var(--hairline)] bg-[var(--canvas)] text-[var(--ink)]"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              autoFocus
              className={fieldClass}
              type={
                current?.type === "email"
                  ? "email"
                  : current?.type === "phone"
                    ? "tel"
                    : current?.type === "number"
                      ? "number"
                      : "text"
              }
              value={value}
              onChange={(e) =>
                current && setAnswers((a) => ({ ...a, [current.id]: e.target.value }))
              }
              required={current?.required}
            />
          )}
          {error ? <p className="mt-3 type-caption text-[var(--danger)]">{error}</p> : null}
          <div className="mt-8">
            <Button type="submit" variant="store-hero" disabled={!canNext || submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step >= fields.length - 1 ? (
                "Enviar"
              ) : (
                "Continuar"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
