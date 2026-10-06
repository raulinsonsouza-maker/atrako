import { ModuleGate } from "@/components/modules/ModuleGate";

export default function CriarCupomLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="commerce">{children}</ModuleGate>;
}