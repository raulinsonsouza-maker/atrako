import { getDashboardContext } from "@/lib/dashboard-context";
import { LeadsPageContent } from "@/components/features/LeadsPageContent";

export default async function LeadsPage() {
  const { tenantId } = await getDashboardContext();

  return <LeadsPageContent tenantId={tenantId} />;
}
