import type { Metadata } from "next";
import { headers } from "next/headers";
import { ModuleGate } from "@/components/modules/ModuleGate";
import { AtendimentoShell } from "@/components/atendimento/AtendimentoShell";
import { LP_DOMAINS } from "@/lib/lp-domains";
import { matchLpPathArea } from "@/lib/lp-path-areas";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0].toLowerCase();
  const path =
    h.get("x-pathname") ||
    h.get("x-invoke-path") ||
    h.get("next-url") ||
    "";
  const pathBrand = matchLpPathArea(path)?.name;
  const brand = LP_DOMAINS[host]?.name || pathBrand;
  return { title: brand ? `${brand} · Atendimento` : "Atendimento" };
}

export default function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate moduleKey="crm">
      <AtendimentoShell>{children}</AtendimentoShell>
    </ModuleGate>
  );
}
