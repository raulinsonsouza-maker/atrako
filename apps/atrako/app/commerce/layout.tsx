import { ModuleGate } from "@/components/modules/ModuleGate";

export default function CommerceLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="commerce">{children}</ModuleGate>;
}