import { ModuleGate } from "@/components/modules/ModuleGate";

export default function CriarAutomacaoLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="social">{children}</ModuleGate>;
}