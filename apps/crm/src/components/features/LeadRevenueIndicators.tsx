"use client";

import { useState, useEffect } from "react";
import { getLeadRevenueStats } from "@/server/actions/opportunity";
import { Card, CardContent } from "@/design/components";
import { DollarSign, ShoppingCart, Calendar, TrendingUp } from "lucide-react";

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

export function LeadRevenueIndicators({ leadId, tenantId }: { leadId: string; tenantId: string }) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getLeadRevenueStats>> | null>(null);

  useEffect(() => {
    getLeadRevenueStats(leadId, tenantId).then(setStats);
  }, [leadId, tenantId]);

  if (!stats) return null;

  const { totalComprado, numCompras, ultimaCompra, valorMedio } = stats;
  if (numCompras === 0) return null;

  const items = [
    { label: "Total comprado", value: fmtCurrency(totalComprado), icon: DollarSign },
    { label: "Compras", value: String(numCompras), icon: ShoppingCart },
    { label: "Última compra", value: fmtDate(ultimaCompra), icon: Calendar },
    { label: "Ticket médio", value: valorMedio != null ? fmtCurrency(valorMedio) : "—", icon: TrendingUp },
  ];

  return (
    <Card>
      <CardContent className="py-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
