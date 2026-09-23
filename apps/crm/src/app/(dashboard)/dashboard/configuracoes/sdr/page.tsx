import Link from "next/link";
import { getDashboardContext } from "@/lib/dashboard-context";
import { getTenantSdrConfig } from "@/server/actions/sdrConfig";
import { SdrConfigView } from "@/components/features/sdr/SdrConfigView";

export default async function SdrConfigPage() {
  const { session, tenantId } = await getDashboardContext();
  const isAdmin = (session.user as { role?: string }).role === "TENANT_ADMIN";
  const config = await getTenantSdrConfig(tenantId);

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        <Link href="/dashboard/configuracoes" className="text-primary-600 hover:underline dark:text-primary-400">
          Configurações
        </Link>
        <span className="mx-1">›</span>
        <span className="text-neutral-900 dark:text-neutral-100">SDR IA</span>
      </p>
      <SdrConfigView tenantId={tenantId} initialConfig={config} isAdmin={isAdmin} />
    </div>
  );
}
