import { ModuleGate } from "@/components/modules/ModuleGate";

export default function CriarFormularioLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="forms">{children}</ModuleGate>;
}