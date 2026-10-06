import { ModuleGate } from "@/components/modules/ModuleGate";

export default function RelacionamentoLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="relacionamento">{children}</ModuleGate>;
}