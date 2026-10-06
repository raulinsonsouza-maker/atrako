import { ModuleGate } from "@/components/modules/ModuleGate";

export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="agenda">{children}</ModuleGate>;
}