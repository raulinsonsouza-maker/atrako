import { ModuleGate } from "@/components/modules/ModuleGate";

export default function FormsLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="forms">{children}</ModuleGate>;
}