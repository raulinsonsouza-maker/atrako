import { ModuleGate } from "@/components/modules/ModuleGate";

export default function WhatsappLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGate moduleKey="whatsapp">{children}</ModuleGate>;
}