"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Check,
  Trash2,
  Edit,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { Badge } from "@/design/components";
import { confirmTransaction, deleteTransaction } from "@/server/actions/finance";

interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE";
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  description: string;
  amount: number;
  date: string | Date;
  category?: { name: string; color: string } | null;
  sale?: { lead?: { name: string } | null } | null;
}

interface TransactionsListProps {
  transactions: Transaction[];
  tenantId: string;
  onAddNew?: () => void;
  onEdit?: (transaction: Transaction) => void;
  className?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

const STATUS_LABELS = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
};

const STATUS_VARIANTS: Record<string, "warning" | "success" | "error"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELLED: "error",
};

export function TransactionsList({
  transactions,
  tenantId,
  onAddNew,
  onEdit,
  className,
}: TransactionsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "INCOME" | "EXPENSE">("all");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filtered = transactions.filter((tx) => {
    if (filter !== "all" && tx.type !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return tx.description.toLowerCase().includes(q);
    }
    return true;
  });

  const handleConfirm = (id: string) => {
    startTransition(async () => {
      await confirmTransaction(id, tenantId);
      router.refresh();
      setOpenMenuId(null);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta transacao?")) return;
    startTransition(async () => {
      try {
        await deleteTransaction(id, tenantId);
        router.refresh();
      } catch (error) {
        alert((error as Error).message);
      }
      setOpenMenuId(null);
    });
  };

  return (
    <div
      className={clsx(
        "rounded-xl overflow-hidden",
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200/60 dark:border-neutral-800",
        "shadow-card",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100">
          Transacoes
        </h3>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={clsx(
                "h-8 w-40 rounded-md border border-neutral-200 bg-neutral-50 pl-8 pr-3 text-footnote",
                "placeholder:text-neutral-400",
                "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
                "dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              )}
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {[
              { key: "all", label: "Todas" },
              { key: "INCOME", label: "Receitas" },
              { key: "EXPENSE", label: "Despesas" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key as typeof filter)}
                className={clsx(
                  "px-3 py-1.5 text-caption-1 font-medium transition-colors",
                  filter === item.key
                    ? item.key === "INCOME"
                      ? "bg-success-500 text-white"
                      : item.key === "EXPENSE"
                        ? "bg-error-500 text-white"
                        : "bg-primary-500 text-white"
                    : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className={clsx(
                "flex items-center gap-1.5 h-8 px-3 rounded-md text-footnote font-medium",
                "bg-primary-500 text-white hover:bg-primary-600",
                "transition-colors duration-fast"
              )}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Nova
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-footnote text-neutral-500 dark:text-neutral-400">
              Nenhuma transacao encontrada
            </p>
          </div>
        ) : (
          filtered.map((tx) => (
            <div
              key={tx.id}
              className={clsx(
                "flex items-center gap-3 px-4 py-3",
                "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                "transition-colors duration-fast"
              )}
            >
              {/* Icon */}
              <div
                className={clsx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  tx.type === "INCOME"
                    ? "bg-success-500/10 dark:bg-success-500/15"
                    : "bg-error-500/10 dark:bg-error-500/15"
                )}
              >
                {tx.type === "INCOME" ? (
                  <ArrowUpRight className="h-4 w-4 text-success-500" strokeWidth={1.75} />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-error-500" strokeWidth={1.75} />
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-subhead font-medium text-neutral-900 dark:text-neutral-100">
                  {tx.description}
                </p>
                <div className="flex items-center gap-2 text-caption-1 text-neutral-500 dark:text-neutral-400">
                  {tx.category && (
                    <span className="flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: tx.category.color }}
                      />
                      {tx.category.name}
                    </span>
                  )}
                  {tx.sale?.lead?.name && (
                    <span className="text-primary-600 dark:text-primary-400">
                      {tx.sale.lead.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Date */}
              <div className="text-caption-1 text-neutral-500 dark:text-neutral-400">
                {formatDate(tx.date)}
              </div>

              {/* Status */}
              <Badge variant={STATUS_VARIANTS[tx.status]} size="sm" dot>
                {STATUS_LABELS[tx.status]}
              </Badge>

              {/* Amount */}
              <div
                className={clsx(
                  "min-w-20 text-right text-subhead font-semibold tabular-nums",
                  tx.type === "INCOME"
                    ? "text-success-600 dark:text-success-400"
                    : "text-error-600 dark:text-error-400"
                )}
              >
                {tx.type === "INCOME" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </div>

              {/* Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenuId(openMenuId === tx.id ? null : tx.id)}
                  className={clsx(
                    "flex h-7 w-7 items-center justify-center rounded-md",
                    "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600",
                    "dark:hover:bg-neutral-800 dark:hover:text-neutral-300",
                    "transition-colors duration-fast"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                </button>

                {openMenuId === tx.id && (
                  <div
                    className={clsx(
                      "absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg",
                      "bg-white dark:bg-neutral-900",
                      "border border-neutral-200/60 dark:border-neutral-700",
                      "shadow-dropdown",
                      "animate-scale-in"
                    )}
                  >
                    {tx.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => handleConfirm(tx.id)}
                        disabled={isPending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-footnote text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        <Check className="h-4 w-4 text-success-500" strokeWidth={1.75} />
                        Confirmar
                      </button>
                    )}
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          onEdit(tx);
                          setOpenMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-footnote text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        <Edit className="h-4 w-4" strokeWidth={1.75} />
                        Editar
                      </button>
                    )}
                    {!tx.sale && (
                      <button
                        type="button"
                        onClick={() => handleDelete(tx.id)}
                        disabled={isPending}
                        className="flex w-full items-center gap-2 px-3 py-2 text-footnote text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-900/20"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        Excluir
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
