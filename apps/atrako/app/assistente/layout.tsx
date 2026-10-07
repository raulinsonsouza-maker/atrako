import { redirect } from "next/navigation";
import { ModuleGate } from "@/components/modules/ModuleGate";
import { requireModulePage } from "@/lib/modules/page";
import { homeFallback } from "@/lib/modules/registry";

/** Assistente é a tela inicial: desligado, manda para o dashboard em vez da tela de bloqueio. */
export default async function AssistenteLayout({ children }: { children: React.ReactNode }) {
  const gate = await requireModulePage("assistente");
  if (!gate.ok) redirect(homeFallback(gate.workspaceId));
  return <ModuleGate moduleKey="assistente">{children}</ModuleGate>;
}
