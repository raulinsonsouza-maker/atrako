import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plug, Sparkles, Workflow } from "lucide-react";
import { getSession } from "@/lib/symbius/auth";
import { getOrganizationForSession } from "@/lib/symbius/tenant";
import { completeOnboarding } from "./actions";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const org = await getOrganizationForSession(session);
  if (org.onboardingDone) redirect("/app");

  const hasIg = org.igAccounts.length > 0;
  const hasFluxo = org._count.fluxos > 0;

  return (
    <div className="p-6 md:p-10">
      <p className="text-sm text-[var(--symbius-accent)]">Onboarding</p>
      <h1 className="mt-2 text-2xl font-bold">Bem-vindo ao Symbius Flow</h1>
      <p className="mt-2 text-[var(--symbius-muted)]">
        Complete estes passos para começar
      </p>

      <div className="mt-10 max-w-lg space-y-4">
        <div className={`symbius-card flex items-start gap-4 ${hasIg ? "opacity-80" : ""}`}>
          <Plug className="mt-1 h-6 w-6 text-[var(--symbius-primary)]" />
          <div className="flex-1">
            <p className="font-semibold">1. Conectar Instagram</p>
            <p className="mt-1 text-sm text-[var(--symbius-muted)]">
              Vincule sua conta Professional via Instagram Login
            </p>
            {!hasIg && (
              <Link
                href="/app/connect"
                className="symbius-btn-primary mt-4 inline-flex gap-2 text-sm"
              >
                Conectar
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {hasIg && (
              <p className="mt-2 text-sm text-[var(--symbius-accent)]">✓ Conectado</p>
            )}
          </div>
        </div>

        <div
          className={`symbius-card flex items-start gap-4 ${!hasIg ? "opacity-50" : ""}`}
        >
          <Workflow className="mt-1 h-6 w-6 text-[var(--symbius-accent)]" />
          <div className="flex-1">
            <p className="font-semibold">2. Criar primeiro fluxo</p>
            <p className="mt-1 text-sm text-[var(--symbius-muted)]">
              Use um template de boas-vindas ou comentário→DM
            </p>
            {hasIg && !hasFluxo && (
              <Link
                href="/app/flows/new"
                className="symbius-btn-outline mt-4 inline-flex gap-2 text-sm"
              >
                Criar fluxo
              </Link>
            )}
            {hasFluxo && (
              <p className="mt-2 text-sm text-[var(--symbius-accent)]">✓ Fluxo criado</p>
            )}
          </div>
        </div>

        <div
          className={`symbius-card flex items-start gap-4 ${!hasFluxo ? "opacity-50" : ""}`}
        >
          <Sparkles className="mt-1 h-6 w-6 text-[var(--symbius-primary)]" />
          <div className="flex-1">
            <p className="font-semibold">3. Ir para o dashboard</p>
            {hasIg && (
              <form action={completeOnboarding}>
                <button type="submit" className="symbius-btn-primary mt-4 text-sm">
                  Concluir onboarding
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
