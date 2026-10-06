import { ModuleGate } from "@/components/modules/ModuleGate";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="finance">{children}</ModuleGate>;
}