import { ModuleGate } from "@/components/modules/ModuleGate";
import { CommerceShell } from "@/components/commerce/CommerceShell";

export default function CommerceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate moduleKey="commerce">
      <CommerceShell>{children}</CommerceShell>
    </ModuleGate>
  );
}
