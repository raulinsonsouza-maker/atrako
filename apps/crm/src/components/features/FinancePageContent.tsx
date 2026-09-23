"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { clsx } from "clsx";
import { Calendar, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { FinanceKpis } from "./FinanceKpis";
import { TransactionsList } from "./TransactionsList";
import { TransactionModal } from "./TransactionModal";
import { usePageHeader } from "@/contexts/PageHeaderContext";

// OTIMIZADO: Dynamic imports para componentes de graficos (recharts)
// Isso reduz o bundle inicial e carrega os graficos sob demanda
const CashFlowChart = dynamic(
  () => import("./CashFlowChart").then((mod) => mod.CashFlowChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    ),
  }
);

const CategoryBreakdown = dynamic(
  () => import("./CategoryBreakdown").then((mod) => mod.CategoryBreakdown),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    ),
  }
);

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string;
}

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  description: string;
  amount: number;
  date: string | Date;
  category?: { name: string; color: string } | null;
  sale?: { lead?: { name: string } | null } | null;
  categoryId?: string | null;
  notes?: string | null;
}

interface CashFlowDataPoint {
  date: string;
  receita: number;
  despesa: number;
  saldo: number;
}

interface CategoryData {
  name: string;
  color: string;
  total: number;
}

interface FinancePageContentProps {
  tenantId: string;
  kpis: {
    receita: number;
    despesas: number;
    saldo: number;
    aReceber: number;
    aPagar: number;
  };
  transactions: Transaction[];
  categories: Category[];
  cashFlowData: CashFlowDataPoint[];
  categoryBreakdown: {
    income: CategoryData[];
    expense: CategoryData[];
  };
}

type PeriodType = "current-month" | "last-month" | "last-3-months" | "current-year" | "custom";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "current-month", label: "Este Mes" },
  { value: "last-month", label: "Mes Anterior" },
  { value: "last-3-months", label: "Ultimos 3 Meses" },
  { value: "current-year", label: "Este Ano" },
  { value: "custom", label: "Personalizado" },
];

function getPeriodDates(period: PeriodType): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "current-month":
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59),
      };
    case "last-month":
      return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0, 23, 59, 59),
      };
    case "last-3-months":
      return {
        start: new Date(year, month - 2, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59),
      };
    case "current-year":
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59),
      };
    default:
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59),
      };
  }
}

function formatPeriodLabel(period: PeriodType): string {
  const { start, end } = getPeriodDates(period);
  const opts: Intl.DateTimeFormatOptions = { month: "short", year: "numeric" };
  
  if (period === "current-month" || period === "last-month") {
    return start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  
  return `${start.toLocaleDateString("pt-BR", opts)} - ${end.toLocaleDateString("pt-BR", opts)}`;
}

export function FinancePageContent({
  tenantId,
  kpis,
  transactions,
  categories,
  cashFlowData,
  categoryBreakdown,
}: FinancePageContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [period, setPeriod] = useState<PeriodType>("current-month");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  // Filtrar transacoes pelo periodo selecionado
  const { start, end } = useMemo(() => getPeriodDates(period), [period]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= start && txDate <= end;
    });
  }, [transactions, start, end]);

  // Recalcular KPIs baseado nas transacoes filtradas
  const filteredKpis = useMemo(() => {
    const confirmed = filteredTransactions.filter((tx) => tx.status === "CONFIRMED");
    const pending = filteredTransactions.filter((tx) => tx.status === "PENDING");

    const receita = confirmed
      .filter((tx) => tx.type === "INCOME")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const despesas = confirmed
      .filter((tx) => tx.type === "EXPENSE")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const aReceber = pending
      .filter((tx) => tx.type === "INCOME")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const aPagar = pending
      .filter((tx) => tx.type === "EXPENSE")
      .reduce((sum, tx) => sum + tx.amount, 0);

    return {
      receita,
      despesas,
      saldo: receita - despesas,
      aReceber,
      aPagar,
    };
  }, [filteredTransactions]);

  // Filtrar cashflow pelo periodo e preencher todos os dias para o grafico exibir sempre
  const filteredCashFlow = useMemo(() => {
    const byDate = new Map<string, { receita: number; despesa: number; saldo: number }>();
    cashFlowData.forEach((d) => {
      const date = new Date(d.date);
      if (date >= start && date <= end) {
        const key = d.date.slice(0, 10);
        byDate.set(key, {
          receita: d.receita,
          despesa: d.despesa,
          saldo: d.receita - d.despesa,
        });
      }
    });
    const result: CashFlowDataPoint[] = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (current <= endDay) {
      const key = current.toISOString().slice(0, 10);
      const existing = byDate.get(key);
      result.push({
        date: key,
        receita: existing?.receita ?? 0,
        despesa: existing?.despesa ?? 0,
        saldo: existing?.saldo ?? 0,
      });
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [cashFlowData, start, end]);

  // Recalcular breakdown por categoria
  const filteredCategoryBreakdown = useMemo(() => {
    const confirmed = filteredTransactions.filter((tx) => tx.status === "CONFIRMED");

    const incomeByCategory = new Map<string, { name: string; color: string; total: number }>();
    const expenseByCategory = new Map<string, { name: string; color: string; total: number }>();

    confirmed.forEach((tx) => {
      const catName = tx.category?.name || "Outros";
      const catColor = tx.category?.color || "#94a3b8";
      const map = tx.type === "INCOME" ? incomeByCategory : expenseByCategory;

      if (map.has(catName)) {
        map.get(catName)!.total += tx.amount;
      } else {
        map.set(catName, { name: catName, color: catColor, total: tx.amount });
      }
    });

    return {
      income: Array.from(incomeByCategory.values()),
      expense: Array.from(expenseByCategory.values()),
    };
  }, [filteredTransactions]);

  const handleAddNew = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const { setSummary } = usePageHeader();
  useEffect(() => {
    setSummary(formatPeriodLabel(period));
    return () => setSummary(undefined);
  }, [period, setSummary]);

  return (
    <div className="space-y-5">
      {/* Header com filtros: sem H1 duplicado; periodo no Header via context */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-subhead text-neutral-500 dark:text-neutral-400">
            Transações e resumo do período
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPeriodMenu(!showPeriodMenu)}
              className={clsx(
                "flex items-center gap-2 h-9 px-4 rounded-lg",
                "bg-white dark:bg-neutral-800",
                "border border-neutral-200 dark:border-neutral-700",
                "text-footnote font-medium text-neutral-700 dark:text-neutral-300",
                "hover:bg-neutral-50 dark:hover:bg-neutral-700",
                "transition-colors duration-fast",
                "shadow-sm"
              )}
            >
              <Calendar className="h-4 w-4 text-neutral-500" strokeWidth={1.75} />
              {PERIOD_OPTIONS.find((p) => p.value === period)?.label}
              <ChevronDown className="h-4 w-4 text-neutral-400" strokeWidth={1.75} />
            </button>

            {showPeriodMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPeriodMenu(false)}
                />
                <div
                  className={clsx(
                    "absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl",
                    "bg-white dark:bg-neutral-900",
                    "border border-neutral-200/60 dark:border-neutral-700",
                    "shadow-dropdown",
                    "animate-scale-in"
                  )}
                >
                  {PERIOD_OPTIONS.filter((p) => p.value !== "custom").map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setPeriod(option.value);
                        setShowPeriodMenu(false);
                      }}
                      className={clsx(
                        "flex w-full items-center px-4 py-2.5 text-footnote",
                        "transition-colors",
                        period === option.value
                          ? "bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
                          : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPending}
            className={clsx(
              "flex items-center justify-center h-9 w-9 rounded-lg",
              "bg-white dark:bg-neutral-800",
              "border border-neutral-200 dark:border-neutral-700",
              "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
              "hover:bg-neutral-50 dark:hover:bg-neutral-700",
              "transition-colors duration-fast",
              "shadow-sm",
              isPending && "opacity-50"
            )}
            title="Atualizar dados"
          >
            <RefreshCw
              className={clsx("h-4 w-4", isPending && "animate-spin")}
              strokeWidth={1.75}
            />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <FinanceKpis {...filteredKpis} />

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CashFlowChart data={filteredCashFlow} />
        <CategoryBreakdown
          income={filteredCategoryBreakdown.income}
          expense={filteredCategoryBreakdown.expense}
        />
      </div>

      {/* Transactions */}
      <TransactionsList
        transactions={filteredTransactions}
        tenantId={tenantId}
        onAddNew={handleAddNew}
        onEdit={handleEdit}
      />

      {/* Modal */}
      <TransactionModal
        open={isModalOpen}
        onClose={handleCloseModal}
        tenantId={tenantId}
        categories={categories}
        editTransaction={editingTransaction}
      />
    </div>
  );
}
