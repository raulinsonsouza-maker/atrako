"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { z } from "zod";
import { TransactionType, TransactionStatus } from "@prisma/client";

// Helper para serializar Decimal para Number
function serializeTransaction<T extends { amount?: unknown }>(tx: T): T & { amount: number } {
  return {
    ...tx,
    amount: tx.amount != null ? Number(tx.amount) : 0,
  };
}

// Validação de tenant (modo embed Atrako libera sem sessão)
async function assertTenantAccess(tenantId: string) {
  if (process.env.ATRAKO_EMBED_OPEN === "true") {
    const tenant = await db.tenant.findFirst({
      where: { id: tenantId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!tenant) throw new Error("Tenant inválido");
    return null;
  }
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");
  return session;
}

// ============ CATEGORIAS ============

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(TransactionType),
  color: z.string().max(20),
  icon: z.string().max(50).optional(),
});

export async function listCategories(tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.financialCategory.findMany({
    where: { tenantId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(tenantId: string, data: z.infer<typeof categorySchema>) {
  await assertTenantAccess(tenantId);

  const d = categorySchema.parse(data);
  return db.financialCategory.create({
    data: {
      tenantId,
      name: d.name,
      type: d.type,
      color: d.color,
      icon: d.icon ?? null,
    },
  });
}

export async function updateCategory(
  id: string,
  tenantId: string,
  data: Partial<z.infer<typeof categorySchema>>
) {
  await assertTenantAccess(tenantId);

  return db.financialCategory.updateMany({
    where: { id, tenantId },
    data,
  });
}

export async function deleteCategory(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  // Verifica se há transações usando esta categoria
  const count = await db.transaction.count({
    where: { tenantId, categoryId: id },
  });
  if (count > 0) {
    throw new Error("Não é possível excluir categoria com transações vinculadas");
  }

  await db.financialCategory.deleteMany({
    where: { id, tenantId },
  });
}

export async function ensureDefaultCategories(tenantId: string) {
  await assertTenantAccess(tenantId);

  const existing = await db.financialCategory.count({ where: { tenantId } });
  if (existing > 0) return;

  const defaults = [
    // Receitas
    { name: "Vendas", type: TransactionType.INCOME, color: "#22c55e", icon: "shopping-cart", isDefault: true },
    { name: "Serviços", type: TransactionType.INCOME, color: "#3b82f6", icon: "briefcase" },
    { name: "Comissões", type: TransactionType.INCOME, color: "#8b5cf6", icon: "percent" },
    { name: "Outras Receitas", type: TransactionType.INCOME, color: "#6b7280", icon: "plus-circle" },
    // Despesas
    { name: "Marketing/Ads", type: TransactionType.EXPENSE, color: "#f97316", icon: "megaphone", isDefault: true },
    { name: "Salários", type: TransactionType.EXPENSE, color: "#ef4444", icon: "users" },
    { name: "Ferramentas/Software", type: TransactionType.EXPENSE, color: "#0ea5e9", icon: "laptop" },
    { name: "Escritório", type: TransactionType.EXPENSE, color: "#a855f7", icon: "building" },
    { name: "Impostos", type: TransactionType.EXPENSE, color: "#dc2626", icon: "file-text" },
    { name: "Outras Despesas", type: TransactionType.EXPENSE, color: "#6b7280", icon: "minus-circle" },
  ];

  await db.financialCategory.createMany({
    data: defaults.map((d) => ({ tenantId, ...d })),
  });
}

// ============ TRANSAÇÕES ============

const transactionSchema = z.object({
  type: z.nativeEnum(TransactionType),
  categoryId: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  date: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  status: z.nativeEnum(TransactionStatus).optional(),
  notes: z.string().max(2000).optional(),
});

const updateTransactionSchema = transactionSchema.partial();

interface TransactionFilters {
  type?: TransactionType;
  categoryId?: string;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export async function listTransactions(tenantId: string, filters?: TransactionFilters) {
  await assertTenantAccess(tenantId);

  const where: Record<string, unknown> = { tenantId };

  if (filters?.type) where.type = filters.type;
  if (filters?.categoryId) where.categoryId = filters.categoryId;
  if (filters?.status) where.status = filters.status;
  if (filters?.startDate || filters?.endDate) {
    where.date = {};
    if (filters.startDate) (where.date as Record<string, unknown>).gte = filters.startDate;
    if (filters.endDate) (where.date as Record<string, unknown>).lte = filters.endDate;
  }
  if (filters?.search?.trim()) {
    where.description = { contains: filters.search, mode: "insensitive" };
  }

  const transactions = await db.transaction.findMany({
    where,
    include: {
      category: true,
      sale: {
        include: {
          lead: { select: { id: true, name: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
    take: 500,
  });

  return transactions.map((tx) => ({
    ...serializeTransaction(tx),
    sale: tx.sale
      ? {
          ...tx.sale,
          amount: Number(tx.sale.amount),
        }
      : null,
  }));
}

export async function createTransaction(tenantId: string, data: z.infer<typeof transactionSchema>) {
  const session = await assertTenantAccess(tenantId);
  const userId = (session.user as { id?: string })?.id;

  const d = transactionSchema.parse(data);

  const transaction = await db.transaction.create({
    data: {
      tenantId,
      type: d.type,
      categoryId: d.categoryId ?? null,
      description: d.description,
      amount: d.amount,
      date: d.date,
      dueDate: d.dueDate ?? null,
      status: d.status ?? TransactionStatus.PENDING,
      notes: d.notes ?? null,
      paidAt: d.status === TransactionStatus.CONFIRMED ? d.date : null,
      createdById: userId ?? null,
    },
    include: { category: true },
  });

  return serializeTransaction(transaction);
}

export async function updateTransaction(
  id: string,
  tenantId: string,
  data: z.infer<typeof updateTransactionSchema>
) {
  await assertTenantAccess(tenantId);

  const d = updateTransactionSchema.parse(data);

  // Se mudou para CONFIRMED, define paidAt
  const updateData: Record<string, unknown> = { ...d };
  if (d.status === TransactionStatus.CONFIRMED && !d.dueDate) {
    updateData.paidAt = new Date();
  }

  await db.transaction.updateMany({
    where: { id, tenantId },
    data: updateData,
  });
}

export async function deleteTransaction(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  // Não permite deletar transações vinculadas a vendas
  const tx = await db.transaction.findFirst({
    where: { id, tenantId },
    select: { saleId: true },
  });

  if (tx?.saleId) {
    throw new Error("Não é possível excluir transação vinculada a uma venda");
  }

  await db.transaction.deleteMany({
    where: { id, tenantId },
  });
}

export async function confirmTransaction(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  await db.transaction.updateMany({
    where: { id, tenantId, status: TransactionStatus.PENDING },
    data: {
      status: TransactionStatus.CONFIRMED,
      paidAt: new Date(),
    },
  });
}

// ============ DASHBOARD / KPIs ============

export async function getFinanceKpis(tenantId: string, days: number = 30) {
  await assertTenantAccess(tenantId);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [incomeConfirmed, expenseConfirmed, incomePending, expensePending] = await Promise.all([
    db.transaction.aggregate({
      where: {
        tenantId,
        type: TransactionType.INCOME,
        status: TransactionStatus.CONFIRMED,
        date: { gte: startDate },
      },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: {
        tenantId,
        type: TransactionType.EXPENSE,
        status: TransactionStatus.CONFIRMED,
        date: { gte: startDate },
      },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: {
        tenantId,
        type: TransactionType.INCOME,
        status: TransactionStatus.PENDING,
      },
      _sum: { amount: true },
    }),
    db.transaction.aggregate({
      where: {
        tenantId,
        type: TransactionType.EXPENSE,
        status: TransactionStatus.PENDING,
      },
      _sum: { amount: true },
    }),
  ]);

  const receita = Number(incomeConfirmed._sum.amount ?? 0);
  const despesas = Number(expenseConfirmed._sum.amount ?? 0);
  const saldo = receita - despesas;
  const aReceber = Number(incomePending._sum.amount ?? 0);
  const aPagar = Number(expensePending._sum.amount ?? 0);

  return { receita, despesas, saldo, aReceber, aPagar };
}

// OTIMIZADO: Usa GROUP BY no banco para reduzir processamento em memória
export async function getCashFlowData(tenantId: string, days: number = 30) {
  await assertTenantAccess(tenantId);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Usa SQL raw com GROUP BY para agregação no banco
  const dailyData = await db.$queryRaw<
    Array<{ date: Date; type: string; total: bigint }>
  >`
    SELECT 
      DATE("date") as date,
      "type"::text as type,
      SUM("amount") as total
    FROM "Transaction"
    WHERE "tenantId" = ${tenantId}
      AND "status" = 'CONFIRMED'
      AND "date" >= ${startDate}
    GROUP BY DATE("date"), "type"
    ORDER BY DATE("date") ASC
  `;

  // Agrupar resultados por data
  const groupedData: Record<string, { receita: number; despesa: number }> = {};

  dailyData.forEach((row) => {
    const dateKey = row.date.toISOString().split("T")[0];
    if (!groupedData[dateKey]) {
      groupedData[dateKey] = { receita: 0, despesa: 0 };
    }
    const amount = Number(row.total);
    if (row.type === "INCOME") {
      groupedData[dateKey].receita += amount;
    } else {
      groupedData[dateKey].despesa += amount;
    }
  });

  // Converter para array ordenado
  const result = Object.entries(groupedData)
    .map(([date, data]) => ({
      date,
      receita: data.receita,
      despesa: data.despesa,
      saldo: data.receita - data.despesa,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

// OTIMIZADO: Usa GROUP BY no banco para reduzir processamento em memória
export async function getCategoryBreakdown(tenantId: string, days: number = 30) {
  await assertTenantAccess(tenantId);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Usa SQL raw com GROUP BY e JOIN para agregação no banco
  const categoryData = await db.$queryRaw<
    Array<{ 
      type: string; 
      category_name: string | null; 
      category_color: string | null; 
      total: bigint 
    }>
  >`
    SELECT 
      t."type"::text as type,
      c."name" as category_name,
      c."color" as category_color,
      SUM(t."amount") as total
    FROM "Transaction" t
    LEFT JOIN "FinancialCategory" c ON t."categoryId" = c."id"
    WHERE t."tenantId" = ${tenantId}
      AND t."status" = 'CONFIRMED'
      AND t."date" >= ${startDate}
    GROUP BY t."type", c."name", c."color"
    ORDER BY total DESC
  `;

  const income: Array<{ name: string; color: string; total: number }> = [];
  const expense: Array<{ name: string; color: string; total: number }> = [];

  categoryData.forEach((row) => {
    const item = {
      name: row.category_name ?? "Sem categoria",
      color: row.category_color ?? "#6b7280",
      total: Number(row.total),
    };

    if (row.type === "INCOME") {
      income.push(item);
    } else {
      expense.push(item);
    }
  });

  return { income, expense };
}

// ============ INTEGRAÇÃO COM SALES ============

export async function createTransactionFromSale(
  tenantId: string,
  saleId: string,
  leadName: string,
  amount: number,
  soldAt: Date
) {
  // Busca categoria padrão de vendas
  let category = await db.financialCategory.findFirst({
    where: { tenantId, type: TransactionType.INCOME, isDefault: true },
  });

  // Se não existir, cria categorias padrão
  if (!category) {
    await ensureDefaultCategories(tenantId);
    category = await db.financialCategory.findFirst({
      where: { tenantId, type: TransactionType.INCOME, isDefault: true },
    });
  }

  return db.transaction.create({
    data: {
      tenantId,
      type: TransactionType.INCOME,
      status: TransactionStatus.CONFIRMED,
      categoryId: category?.id ?? null,
      description: `Venda - ${leadName}`,
      amount,
      date: soldAt,
      paidAt: soldAt,
      saleId,
    },
  });
}

// Sincroniza vendas existentes que não têm transações associadas
// OTIMIZADO: Usa createMany para evitar N+1 queries
export async function syncExistingSales(tenantId: string) {
  await assertTenantAccess(tenantId);

  // Busca vendas que não têm transação associada
  const salesWithoutTransaction = await db.sale.findMany({
    where: {
      tenantId,
      transaction: null,
    },
    include: {
      lead: { select: { name: true } },
    },
  });

  if (salesWithoutTransaction.length === 0) {
    return { synced: 0 };
  }

  // Garante que existem categorias padrão
  await ensureDefaultCategories(tenantId);

  // Busca categoria padrão de vendas
  const category = await db.financialCategory.findFirst({
    where: { tenantId, type: TransactionType.INCOME, isDefault: true },
  });

  // OTIMIZADO: Cria todas as transações de uma vez usando createMany
  const transactionsData = salesWithoutTransaction.map((sale) => ({
    tenantId,
    type: TransactionType.INCOME,
    status: TransactionStatus.CONFIRMED,
    categoryId: category?.id ?? null,
    description: `Venda - ${sale.lead?.name ?? "Lead"}`,
    amount: sale.amount,
    date: sale.soldAt,
    paidAt: sale.soldAt,
    saleId: sale.id,
  }));

  try {
    const result = await db.transaction.createMany({
      data: transactionsData,
      skipDuplicates: true,
    });
    return { synced: result.count, total: salesWithoutTransaction.length };
  } catch (error) {
    console.error("Erro ao sincronizar vendas em lote:", error);
    return { synced: 0, total: salesWithoutTransaction.length, error: true };
  }
}
