"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, CheckCircle2, Loader2 } from "lucide-react";
import { VILARIS_MOMENT_OPTIONS } from "@/lib/vilaris/forms";

const FORM_SLUG = "vilaris-lp";

export default function LeadForm() {
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
      { fieldId: "role", value: (data.role ?? "").trim() },
      { fieldId: "area", value: (data.area ?? "").trim() },
      { fieldId: "moment", value: (data.moment ?? "").trim() },
      { fieldId: "challenge", value: (data.challenge ?? "").trim() },
    ];

    try {
      const response = await fetch("/api/atrako/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          slug: FORM_SLUG,
          answers,
          pageSlug: "vilaris",
          pageUrl: typeof window !== "undefined" ? window.location.href : "https://vilarisgestao.com.br",
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
        <p className="eyebrow">PRIMEIRO PASSO DADO</p>
        <h3>
          Sua conversa
          <br />
          começa aqui.
        </h3>
        <p>
          Recebemos seus dados. A equipe Vilaris poderá entrar em contato para conhecer melhor seu momento
          profissional.
        </p>
        <p className="form-note">Este envio não representa matrícula automática.</p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <h3>Conte sobre o seu momento.</h3>
      <p className="form-subtitle">Queremos conhecer você e seus próximos planos.</p>
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
            placeholder="voce@exemplo.com"
            maxLength={160}
            required
          />
        </label>
        <label>
          Cargo atual
          <input
            name="role"
            autoComplete="organization-title"
            placeholder="Seu cargo ou última posição"
            maxLength={120}
            required
          />
        </label>
        <label>
          Área de atuação
          <input name="area" placeholder="Em qual área você trabalha?" maxLength={120} required />
        </label>
        <label className="full">
          O que melhor representa seu momento?
          <select name="moment" defaultValue="" required>
            <option value="" disabled>
              Selecione seu momento profissional
            </option>
            {VILARIS_MOMENT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="full">
          Qual é o principal desafio da sua carreira?
          <textarea
            name="challenge"
            placeholder="Compartilhe o que você quer transformar..."
            rows={3}
            minLength={10}
            maxLength={2000}
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
        Ao enviar, você autoriza a Vilaris a usar os dados informados para entrar em contato sobre a mentoria.
      </p>
      <button type="submit" className="button" disabled={state === "sending"}>
        {state === "sending" ? "Enviando..." : "Reservar minha conversa"}
        {state === "sending" ? <Loader2 className="spinning" size={18} /> : <ArrowUpRight size={18} />}
      </button>
      {state === "error" && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <p className="form-note">O preenchimento não representa matrícula automática.</p>
    </form>
  );
}
