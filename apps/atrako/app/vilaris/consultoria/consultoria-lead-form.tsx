"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";

const FORM_SLUG = "vilaris-consultoria-lp";

export default function ConsultoriaLeadForm() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const requestId = useRef("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;

    if ((data.website ?? "").trim()) {
      setState("success");
      return;
    }

    if (!requestId.current) requestId.current = crypto.randomUUID();
    setState("sending");
    setMessage("");

    const answers = [
      { fieldId: "name", value: (data.name ?? "").trim() },
      { fieldId: "phone", value: (data.phone ?? "").trim() },
      { fieldId: "email", value: (data.email ?? "").trim() },
      { fieldId: "company", value: (data.company ?? "").trim() },
    ];

    try {
      const response = await fetch("/api/atrako/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          slug: FORM_SLUG,
          answers,
          pageSlug: "vilaris-consultoria",
          pageUrl:
            typeof window !== "undefined"
              ? window.location.href
              : "https://vilarisgestao.com.br/consultoria",
          requestId: requestId.current,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar. Tente novamente.");
      setState("success");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar. Tente novamente.");
    }
  }

  if (state === "success") {
    return (
      <div className="lead-form form-success" role="status">
        <CheckCircle2 size={46} strokeWidth={1.3} />
        <p className="eyebrow">RECEBIDO</p>
        <h3>
          Vamos conversar
          <br />
          sobre a sua empresa.
        </h3>
        <p>
          Recebemos seus dados. A equipe Vilaris entrará em contato para entender o momento financeiro do
          negócio e o melhor caminho.
        </p>
        <p className="form-note">Sem compromisso. O valor da consultoria entra na conversa.</p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <h3>Fale com a Vilaris</h3>
      <p className="form-subtitle">Resposta em horário comercial. Sem compromisso.</p>
      <div className="form-grid">
        <label className="full">
          Nome completo
          <input
            name="name"
            autoComplete="name"
            placeholder="Como podemos chamar você?"
            minLength={3}
            maxLength={120}
            required
          />
        </label>
        <label>
          WhatsApp
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
            minLength={10}
            maxLength={22}
            required
          />
        </label>
        <label>
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            maxLength={160}
            required
          />
        </label>
        <label className="full">
          Empresa
          <input
            name="company"
            autoComplete="organization"
            placeholder="Nome da empresa"
            minLength={2}
            maxLength={160}
            required
          />
        </label>
        <div className="honeypot" aria-hidden="true">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      </div>
      <p className="privacy-note">
        Ao enviar, você autoriza a Vilaris a usar os dados informados para entrar em contato sobre a
        consultoria financeira.
      </p>
      <button type="submit" className="button" disabled={state === "sending"}>
        {state === "sending" ? "Enviando..." : "Quero conversar agora"}
        {state === "sending" ? <Loader2 className="spinning" size={18} /> : <ArrowUpRight size={18} />}
      </button>
      {state === "error" && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
