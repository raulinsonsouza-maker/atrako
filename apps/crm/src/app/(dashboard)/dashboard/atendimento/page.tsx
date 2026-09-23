import { getDashboardContext } from "@/lib/dashboard-context";
import { ConversationView } from "@/components/features/ConversationView";

export default async function AtendimentoPage() {
  const { tenantId } = await getDashboardContext();

  return <ConversationView tenantId={tenantId} />;
}
