import { listTenants } from "@/server/actions/tenant";
import { Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Badge } from "@/design/components";

export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<string, string> = { STARTER: "Starter", PRO: "Pro", ENTERPRISE: "Enterprise" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativo", SUSPENDED: "Suspenso", TRIAL: "Trial", CANCELLED: "Cancelado" };

export default async function SuperAdminBillingPage() {
  const tenants = await listTenants();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-xl font-semibold text-neutral-900">Faturamento</h2>
        <p className="text-neutral-600">Planos e status de assinatura por tenant.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tenants e assinaturas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tenants.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">Nenhum tenant.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Tenant</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Plano</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Assinatura</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-700">Usuários</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-neutral-100">
                      <td className="px-4 py-3">
                        <span className="font-medium text-neutral-900">{t.name}</span>
                        <span className="ml-2 text-neutral-500">{t.slug}</span>
                      </td>
                      <td className="px-4 py-3">{PLAN_LABEL[t.plan] ?? t.plan}</td>
                      <td className="px-4 py-3">
                        <Badge variant={t.status === "ACTIVE" ? "success" : t.status === "SUSPENDED" ? "error" : "default"}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {t.stripeSubscriptionId ? (
                          <span className="text-green-600">Ativa</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{t._count.users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
