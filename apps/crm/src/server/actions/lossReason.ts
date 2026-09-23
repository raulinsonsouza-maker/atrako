"use server";

import { db } from "@/lib/db";
import { assertTenantAccess } from "@/lib/dashboard-context";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  isDefault: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
});

const updateSchema = createSchema.partial();

export async function listLossReasons(tenantId: string) {
  await assertTenantAccess(tenantId);
  return db.lossReason.findMany({
    where: { tenantId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

export async function getLossReason(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);
  return db.lossReason.findFirst({
    where: { id, tenantId },
  });
}

export async function createLossReason(tenantId: string, data: z.infer<typeof createSchema>) {
  await assertTenantAccess(tenantId);

  const d = createSchema.parse(data);
  return db.lossReason.create({
    data: {
      tenantId,
      name: d.name.trim(),
      isDefault: d.isDefault ?? false,
      order: d.order ?? 0,
    },
  });
}

export async function updateLossReason(id: string, tenantId: string, data: z.infer<typeof updateSchema>) {
  await assertTenantAccess(tenantId);

  const d = updateSchema.parse(data);
  const updateData: {
    name?: string;
    isDefault?: boolean;
    order?: number;
  } = {};
  if (d.name !== undefined) updateData.name = d.name.trim();
  if (d.isDefault !== undefined) updateData.isDefault = d.isDefault;
  if (d.order !== undefined) updateData.order = d.order;

  return db.lossReason.updateMany({
    where: { id, tenantId },
    data: updateData,
  });
}

export async function deleteLossReason(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  // Verificar se está sendo usado
  const [leadsCount, opportunitiesCount] = await Promise.all([
    db.lead.count({ where: { tenantId, lossReasonId: id } }),
    db.opportunity.count({ where: { tenantId, lossReasonId: id } }),
  ]);

  if (leadsCount > 0 || opportunitiesCount > 0) {
    throw new Error(
      `Não é possível excluir este motivo de perda pois está sendo usado em ${leadsCount + opportunitiesCount} registro(s).`
    );
  }

  return db.lossReason.deleteMany({
    where: { id, tenantId },
  });
}

// Inicializar motivos padrão de CRM
const DEFAULT_LOSS_REASONS = [
  "Preço muito alto",
  "Orçamento insuficiente",
  "Concorrente ofereceu melhor proposta",
  "Não há necessidade imediata",
  "Decisão adiada",
  "Mudança de prioridades",
  "Problemas técnicos/compatibilidade",
  "Falta de autorização/aprovação",
  "Cliente não respondeu",
  "Outros",
];

export async function initializeDefaultLossReasons(tenantId: string) {
  await assertTenantAccess(tenantId);

  // Verificar se já existem motivos
  const existing = await db.lossReason.findFirst({
    where: { tenantId },
  });

  if (existing) {
    return; // Já inicializado
  }

  // Criar motivos padrão
  await db.lossReason.createMany({
    data: DEFAULT_LOSS_REASONS.map((name, index) => ({
      tenantId,
      name,
      isDefault: true,
      order: index,
    })),
  });
}
