import { getDashboardContext } from "@/lib/dashboard-context";
import {
  getFinanceKpis,
  listTransactions,
  listCategories,
  ensureDefaultCategories,
  getCashFlowData,
  getCategoryBreakdown,
  syncExistingSales,
} from "@/server/actions/finance";
import { FinancePageContent } from "@/components/features/FinancePageContent";

export default async function FinanceiroPage() {
  if (process.env.ATRAKO_EMBED_OPEN === "true") {
    const atrako =
      process.env.NEXT_PUBLIC_ATRAKO_URL?.trim() || "http://localhost:5000";
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Financeiro unificado no Atrako
        </h1>
        <p className="text-sm text-neutral-500">
          Receitas e despesas do CRM, Commerce e Agenda ficam no módulo Financeiro do
          Atrako.
        </p>
        <a
          href={`${atrako}/modules/finance`}
          target="_top"
          className="inline-flex rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Abrir Financeiro no Atrako
        </a>
      </div>
    );
  }

  const { tenantId } = await getDashboardContext();

  const [, , kpis, transactions, categories, cashFlowData, categoryBreakdown] =
    await Promise.all([
      ensureDefaultCategories(tenantId),
      syncExistingSales(tenantId),
      getFinanceKpis(tenantId, 30),
      listTransactions(tenantId),
      listCategories(tenantId),
      getCashFlowData(tenantId, 30),
      getCategoryBreakdown(tenantId, 30),
    ]);

  return (
    <FinancePageContent
      tenantId={tenantId}
      kpis={kpis}
      transactions={transactions.map((tx) => ({
        ...tx,
        date: tx.date.toISOString(),
        categoryId: tx.categoryId,
        notes: tx.notes,
      }))}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type as "INCOME" | "EXPENSE",
        color: c.color ?? "#737373",
      }))}
      cashFlowData={cashFlowData}
      categoryBreakdown={categoryBreakdown}
    />
  );
}
