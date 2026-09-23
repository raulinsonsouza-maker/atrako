"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { collectClientAttribution } from "@/lib/criar/lp-attribution";

type Props = {
  /** Se houver form publicado, completa via slug */
  formSlug?: string | null;
  title?: string;
  workspaceId?: string;
  productId?: string;
  pageSlug?: string;
  className?: string;
};

const fieldClass =
  "mt-1.5 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

/** Form de captura Atrako (CRM) — usado na LP de leads. */
export function LpLeadForm({
  formSlug,
  title = "Deixe seus dados",
  workspaceId,
  productId,
  pageSlug,
  className,
}: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => nome.trim().length > 1 && email.trim().includes("@"),
    [nome, email],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const attribution = collectClientAttribution({
        productId,
        pageSlug,
        formSlug,
      });

      if (formSlug) {
        const r = await fetch("/api/atrako/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            slug: formSlug,
            answers: [
              { fieldId: "nome", value: nome.trim() },
              { fieldId: "email", value: email.trim() },
              { fieldId: "telefone", value: telefone.trim() },
            ],
            ...attribution,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Não foi possível enviar");
      } else {
        const r = await fetch("/api/atrako/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "lp_lead",
            workspaceId,
            nome: nome.trim(),
            email: email.trim(),
            telefone: telefone.trim() || undefined,
            ...attribution,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Não foi possível enviar");
      }
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
          <p className="type-caption-strong text-[var(--ink)]">Recebido</p>
          <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
            Em breve você recebe o próximo passo no e-mail.
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
      <h3 className="type-caption-strong text-[var(--ink)]">{title}</h3>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">Nome</span>
          <input
            className={fieldClass}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">E-mail</span>
          <input
            className={fieldClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">WhatsApp</span>
          <input
            className={fieldClass}
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
        </label>
      </div>
      {error ? <p className="mt-3 type-caption text-[var(--danger)]">{error}</p> : null}
      <Button
        type="submit"
        variant="primary"
        className="mt-5 w-full"
        disabled={loading || !canSubmit}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Enviando…" : "Enviar"}
      </Button>
    </form>
  );
}
