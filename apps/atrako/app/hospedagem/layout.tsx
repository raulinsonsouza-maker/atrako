import { ModuleGate } from "@/components/modules/ModuleGate";
import { StayShell } from "@/components/stay/StayShell";

export default function StayLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate moduleKey="hospedagem">
      <StayShell>{children}</StayShell>
    </ModuleGate>
  );
}
