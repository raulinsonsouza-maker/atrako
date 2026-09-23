"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button, Input } from "@/design/components";
import { createTransaction, updateTransaction } from "@/server/actions/finance";
import { clsx } from "clsx";

interface Category {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string;
}

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  categories: Category[];
  editTransaction?: {
    id: string;
    type: "INCOME" | "EXPENSE";
    categoryId?: string | null;
    description: string;
    amount: number;
    date: string | Date;
    status: "PENDING" | "CONFIRMED" | "CANCELLED";
    notes?: string | null;
  } | null;
}

export function TransactionModal({
  open,
  onClose,
  tenantId,
  categories,
  editTransaction,
}: TransactionModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editTransaction;

  const [type, setType] = useState<"INCOME" | "EXPENSE">(editTransaction?.type ?? "EXPENSE");
  const [categoryId, setCategoryId] = useState(editTransaction?.categoryId ?? "");
  const [description, setDescription] = useState(editTransaction?.description ?? "");
  const [amount, setAmount] = useState(editTransaction?.amount?.toString() ?? "");
  const [date, setDate] = useState(
    editTransaction?.date
      ? new Date(editTransaction.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<"PENDING" | "CONFIRMED">(
    (editTransaction?.status as "PENDING" | "CONFIRMED") ?? "PENDING"
  );
  const [notes, setNotes] = useState(editTransaction?.notes ?? "");

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount.replace(",", "."));
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Valor inválido");
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing) {
          await updateTransaction(editTransaction.id, tenantId, {
            type,
            categoryId: categoryId || undefined,
            description,
            amount: amountNum,
            date: new Date(date),
            status,
            notes: notes || undefined,
          });
        } else {
          await createTransaction(tenantId, {
            type,
            categoryId: categoryId || undefined,
            description,
            amount: amountNum,
            date: new Date(date),
            status,
            notes: notes || undefined,
          });
        }

        onClose();
        router.refresh();
        
        // Reset form
        if (!isEditing) {
          setDescription("");
          setAmount("");
          setNotes("");
          setCategoryId("");
        }
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const handleClose = () => {
    if (!isPending) {
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEditing ? "Editar Transação" : "Nova Transação"}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo */}
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Tipo
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setType("INCOME");
                setCategoryId("");
              }}
              className={clsx(
                "flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors",
                type === "INCOME"
                  ? "bg-success-600 text-white"
                  : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              )}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => {
                setType("EXPENSE");
                setCategoryId("");
              }}
              className={clsx(
                "flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors",
                type === "EXPENSE"
                  ? "bg-error-600 text-white"
                  : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              )}
            >
              Despesa
            </button>
          </div>
        </div>

        {/* Categoria */}
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Categoria
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Selecione uma categoria</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Descrição */}
        <Input
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Pagamento de fornecedor"
          required
        />

        {/* Valor e Data */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Valor (R$)
            </label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Data
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              required
            />
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Status
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus("PENDING")}
              className={clsx(
                "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                status === "PENDING"
                  ? "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400"
                  : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              )}
            >
              Pendente
            </button>
            <button
              type="button"
              onClick={() => setStatus("CONFIRMED")}
              className={clsx(
                "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                status === "CONFIRMED"
                  ? "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                  : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              )}
            >
              Confirmada
            </button>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Notas adicionais..."
          />
        </div>

        {error && (
          <div className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-900/20 dark:text-error-400">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending} className="flex-1">
            {isEditing ? "Salvar" : "Adicionar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
