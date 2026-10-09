import { ModuleGate } from "@/components/modules/ModuleGate";

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="food">{children}</ModuleGate>;
}
