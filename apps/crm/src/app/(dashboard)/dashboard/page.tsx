import { getDashboardContext } from "@/lib/dashboard-context";
import {
  getDashboardSummary,
  getPipelineOverview,
  getRecentLeads,
} from "@/server/actions/dashboard";
import { DashboardContent } from "@/components/features/DashboardContent";

export default async function DashboardPage() {
  const { tenantId } = await getDashboardContext();

  const [summary, pipeline, recentLeads] = await Promise.all([
    getDashboardSummary(tenantId),
    getPipelineOverview(tenantId),
    getRecentLeads(tenantId, 5),
  ]);

  return (
    <DashboardContent
      summary={summary}
      pipeline={pipeline}
      recentLeads={recentLeads}
    />
  );
}
