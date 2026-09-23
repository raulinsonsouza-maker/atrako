import { getDashboardContext } from "@/lib/dashboard-context";
import { AdsIntegrations } from "@/components/features/AdsIntegrations";

export default async function CampanhasPage() {
  const { tenantId } = await getDashboardContext();

  return <AdsIntegrations tenantId={tenantId} />;
}
