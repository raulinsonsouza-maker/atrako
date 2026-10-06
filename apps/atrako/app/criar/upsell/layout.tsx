import { ModuleGate } from "@/components/modules/ModuleGate";

export default function CriarUpsellLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="commerce">{children}</ModuleGate>;
}