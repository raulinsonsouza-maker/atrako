import type { Metadata } from "next";
import { headers } from "next/headers";
import { ModuleGate } from "@/components/modules/ModuleGate";
import { AtendimentoShell } from "@/components/atendimento/AtendimentoShell";
import { LP_DOMAINS } from "@/lib/lp-domains";

export async function generateMetadata(): Promise<Metadata> {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const brand = LP_DOMAINS[host]?.name;
  return { title: brand ? `${brand} · Atendimento` : "Atendimento" };
}

export default function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate moduleKey="crm">
      <AtendimentoShell>{children}</AtendimentoShell>
    </ModuleGate>
  );
}
