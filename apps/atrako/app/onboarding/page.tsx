"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

const STEPS = ["empresa", "conexoes", "modulos", "pronto"] as const;

const STEP_LABELS: Record<(typeof STEPS)[number], string> = {
  empresa: "Empresa",
  conexoes: "Integrações",
  modulos: "Módulos",
  pronto: "Pronto",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const { data: clientes = [] } = useQuery({
    queryKey: ["onboarding-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });
  const workspaceId = clientes[0]?.id as string | undefined;

  async function markStep(s: string) {
    if (!workspaceId) return;
    await fetch("/api/atrako/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, onboardingStep: s }),
    });
  }

  async function next() {
    const nextIdx = Math.min(step + 1, STEPS.length - 1);
    await markStep(STEPS[nextIdx]);
    setStep(nextIdx);
    if (STEPS[nextIdx] === "pronto") router.push("/");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="type-tagline text-[var(--ink)]">Primeiros passos</h1>
      <p className="type-caption text-[var(--ink-muted-48)]">
        Configure sua empresa, integrações e módulos para começar a operar.
      </p>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-xl border p-4 type-caption ${
              i === step
                ? "border-[var(--ink)] bg-white text-[var(--ink)]"
                : "border-[var(--hairline)] bg-[var(--surface-pearl)] text-[var(--ink-muted-48)]"
            }`}
          >
            <p className="type-body-strong">{STEP_LABELS[s]}</p>
            {i === step && s === "empresa" ? (
              <Link href="/config/empresa" className="mt-2 inline-block text-[var(--primary)] underline">
                Abrir Configurações → Empresa
              </Link>
            ) : null}
            {i === step && s === "conexoes" ? (
              <Link href="/config/conexoes" className="mt-2 inline-block text-[var(--primary)] underline">
                Abrir Configurações → Integrações
              </Link>
            ) : null}
            {i === step && s === "modulos" ? (
              <Link href="/config/modulos" className="mt-2 inline-block text-[var(--primary)] underline">
                Abrir Configurações → Módulos
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={next}
        className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-[22px] py-[11px] type-body text-[var(--on-primary)] active:scale-95"
      >
        {step >= STEPS.length - 2 ? "Concluir" : "Próximo"}
      </button>
    </div>
  );
}
