import { getDashboardContext } from "@/lib/dashboard-context";
import { AppShell, ViewingAsBanner } from "@/components/layout";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getDashboardContext();

  return (
    <>
      {ctx.isViewingAs && ctx.tenantName && <ViewingAsBanner tenantName={ctx.tenantName} />}
      <AppShell tenantId={ctx.tenantId}>{children}</AppShell>
    </>
  );
}
