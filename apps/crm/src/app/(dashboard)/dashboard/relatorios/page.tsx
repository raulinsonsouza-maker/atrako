import { getDashboardContext } from "@/lib/dashboard-context";
import { ReportsView } from "@/components/features/ReportsView";
import { SalesRepReportsView } from "@/components/features/SalesRepReportsView";

export default async function RelatoriosPage() {
  const { tenantId } = await getDashboardContext();

  return (
    <div className="space-y-8">
      <ReportsView tenantId={tenantId} />
      <SalesRepReportsView tenantId={tenantId} />
    </div>
  );
}
