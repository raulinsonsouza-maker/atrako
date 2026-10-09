import { ModuleGate } from "@/components/modules/ModuleGate";
import { FoodShell } from "@/components/food/FoodShell";

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate moduleKey="food">
      <FoodShell>{children}</FoodShell>
    </ModuleGate>
  );
}
