import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { CreateCouponForm } from "./CreateCouponForm";

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="stack-lg">
      <PageHeader title="Cupons" description="Descontos percentuais ou fixos." />
      <div className="grid gap-4 lg:grid-cols-2">
        <CreateCouponForm />
        <Panel>
          {coupons.length === 0 ? (
            <EmptyState title="Nenhum cupom" description="Crie um cupom ao lado." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[var(--text-sm)]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Valor</th>
                    <th className="py-2 pr-3 font-medium">Usos</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border)]">
                      <td className="py-3 pr-3 font-medium">{c.code}</td>
                      <td className="py-3 pr-3">
                        {c.type === "PERCENT" ? `${c.value}%` : formatBRL(c.value)}
                      </td>
                      <td className="py-3 pr-3">
                        {c.usedCount}
                        {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                      </td>
                      <td className="py-3">
                        <Badge tone={c.active ? "success" : "default"}>
                          {c.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
