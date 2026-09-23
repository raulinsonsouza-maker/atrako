"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { getResolvedTenantId } from "@/lib/dashboard-context";
import { z } from "zod";
import { getPipelineWithStages } from "./pipeline";
import { redirect } from "next/navigation";
import { createTransactionFromSale } from "./finance";

// Helper para converter Decimal do Prisma para Number (serialização para Client Components)
function serializeOpportunity<T extends { value?: unknown; sale?: { amount?: unknown } | null }>(
  opp: T
): T & { value: number | null; sale: (T["sale"] & { amount: number | null }) | null } {
  return {
    ...opp,
    value: opp.value != null ? Number(opp.value) : null,
    sale: opp.sale
      ? {
          ...opp.sale,
          amount: opp.sale.amount != null ? Number(opp.sale.amount) : null,
        }
      : null,
  } as T & { value: number | null; sale: (T["sale"] & { amount: number | null }) | null };
}

function serializeSale<T extends { amount?: unknown }>(sale: T): T & { amount: number | null } {
  return {
    ...sale,
    amount: sale.amount != null ? Number(sale.amount) : null,
  };
}

const createSchema = z.object({
  leadId: z.string().uuid(),
  name: z.string().min(1).max(255),
  value: z.number().nonnegative(),
  stageId: z.string().uuid().optional(),
  probability: z.number().min(0).max(100).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  expectedCloseAt: z.coerce.date().optional(),
  campaign: z.string().max(255).optional(),
  productOrService: z.string().max(255).optional(),
});

const updateSchema = createSchema.partial().extend({
  stageId: z.string().uuid().optional(),
  lossReason: z.string().max(500).optional(),
  lossReasonId: z.string().uuid().nullable().optional(),
});

const updateNegotiationSchema = z.object({
  opportunityId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  value: z.number().nonnegative().optional(),
  expectedCloseAt: z.union([z.coerce.date(), z.literal(null)]).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  campaign: z.string().max(255).nullable().optional(),
  productOrService: z.string().max(255).nullable().optional(),
});

const registerSaleSchema = z.object({
  leadId: z.string().uuid(),
  amount: z.number().nonnegative(),
  soldAt: z.coerce.date().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  productOrService: z.string().max(255).optional(),
});

const updateSaleSchema = z.object({
  saleId: z.string().uuid(),
  amount: z.number().nonnegative().optional(),
  soldAt: z.coerce.date().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  productOrService: z.string().max(255).optional(),
});

export async function createOpportunity(tenantId: string, data: z.infer<typeof createSchema>) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const d = createSchema.parse(data);
  const p = await getPipelineWithStages(tenantId);
  const firstStageId = p?.stages[0]?.id;
  if (!firstStageId) throw new Error("Pipeline sem estágios.");

  return db.opportunity.create({
    data: {
      tenantId,
      leadId: d.leadId,
      name: d.name,
      value: d.value,
      stageId: d.stageId ?? firstStageId,
      probability: d.probability ?? undefined,
      assignedToId: d.assignedToId ?? undefined,
      expectedCloseAt: d.expectedCloseAt ?? undefined,
      campaign: d.campaign ?? undefined,
      productOrService: d.productOrService ?? undefined,
      status: "OPEN",
    },
    include: { stage: true, assignedTo: { select: { id: true, name: true } }, lead: { select: { id: true, name: true } } },
  });
}

export async function listOpportunitiesByLead(leadId: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const opportunities = await db.opportunity.findMany({
    where: { leadId, tenantId },
    include: { stage: true, assignedTo: { select: { id: true, name: true } }, sale: true },
    orderBy: { updatedAt: "desc" },
  });

  return opportunities.map(serializeOpportunity);
}

export async function updateOpportunity(id: string, tenantId: string, data: z.infer<typeof updateSchema>) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const o = await db.opportunity.findFirst({ where: { id, tenantId }, select: { status: true } });
  if (!o || o.status !== "OPEN") throw new Error("Oportunidade não encontrada ou já encerrada.");

  const d = updateSchema.parse(data);
  return db.opportunity.updateMany({
    where: { id, tenantId },
    data: d as Record<string, unknown>,
  });
}

export async function updateNegotiation(tenantId: string, data: z.infer<typeof updateNegotiationSchema>) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const d = updateNegotiationSchema.parse(data);
  const opp = await db.opportunity.findFirst({
    where: { id: d.opportunityId, tenantId },
    select: { id: true, leadId: true },
  });
  if (!opp) throw new Error("Negociação não encontrada.");

  await db.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (d.name !== undefined) updateData.name = d.name.trim();
    if (d.value !== undefined) updateData.value = d.value;
    if (d.expectedCloseAt !== undefined) updateData.expectedCloseAt = d.expectedCloseAt;
    if (d.assignedToId !== undefined) updateData.assignedToId = d.assignedToId || null;
    if (d.campaign !== undefined) {
      const campaign = d.campaign ? d.campaign.trim() : "";
      updateData.campaign = campaign ? campaign : null;
    }
    if (d.productOrService !== undefined) {
      const product = d.productOrService ? d.productOrService.trim() : "";
      updateData.productOrService = product ? product : null;
    }

    if (Object.keys(updateData).length > 0) {
      await tx.opportunity.update({
        where: { id: opp.id },
        data: updateData,
      });
    }

    const sale = await tx.sale.findFirst({
      where: { opportunityId: opp.id, tenantId },
      select: { id: true },
    });
    if (sale) {
      const saleUpdate: Record<string, unknown> = {};
      if (d.value !== undefined) saleUpdate.amount = d.value;
      if (d.assignedToId !== undefined) saleUpdate.assignedToId = d.assignedToId || null;
      if (d.productOrService !== undefined) {
        const product = d.productOrService ? d.productOrService.trim() : "";
        saleUpdate.productOrService = product ? product : null;
      }
      if (Object.keys(saleUpdate).length > 0) {
        await tx.sale.update({
          where: { id: sale.id },
          data: saleUpdate,
        });
      }
    }

    const total = await tx.opportunity.aggregate({
      where: { tenantId, leadId: opp.leadId },
      _sum: { value: true },
    });
    await tx.lead.update({
      where: { id: opp.leadId },
      data: { dealValue: total._sum.value ?? 0 },
    });
  });
}

export async function setWon(opportunityId: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const o = await db.opportunity.findFirst({
    where: { id: opportunityId, tenantId, status: "OPEN" },
    include: { stage: true, lead: { select: { campaign: true } } },
  });
  if (!o) throw new Error("Oportunidade não encontrada ou já encerrada.");

  const p = await getPipelineWithStages(tenantId);
  const ganhoStage = p?.stages.find(
    (s) => (s.isSystemStage && (s.name || "").toLowerCase().includes("ganho")) || (s.name || "").toLowerCase().includes("ganho")
  );

  const now = new Date();
  await db.$transaction([
    db.opportunity.update({
      where: { id: opportunityId },
      data: { status: "WON", wonAt: now, stageId: ganhoStage?.id ?? o.stageId },
    }),
    db.sale.create({
      data: {
        tenantId,
        leadId: o.leadId,
        opportunityId: o.id,
        amount: o.value,
        productOrService: o.productOrService ?? undefined,
        soldAt: now,
        assignedToId: o.assignedToId ?? undefined,
        campaign: o.campaign ?? (o.lead as { campaign?: string | null })?.campaign ?? undefined,
      },
    }),
  ]);
}

export async function setLost(opportunityId: string, tenantId: string, opts?: { lossReason?: string; lossReasonId?: string }) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const o = await db.opportunity.findFirst({
    where: { id: opportunityId, tenantId, status: "OPEN" },
    include: { stage: true },
  });
  if (!o) throw new Error("Oportunidade não encontrada ou já encerrada.");

  const p = await getPipelineWithStages(tenantId);
  const perdidoStage = p?.stages.find(
    (s) => (s.isSystemStage && (s.name || "").toLowerCase().includes("perdido")) || (s.name || "").toLowerCase().includes("perdido")
  );

  await db.opportunity.update({
    where: { id: opportunityId },
    data: {
      status: "LOST",
      lostAt: new Date(),
      stageId: perdidoStage?.id ?? o.stageId,
      lossReason: opts?.lossReason?.trim().slice(0, 500) || undefined,
      lossReasonId: opts?.lossReasonId || null,
    },
  });
}

export async function listSalesByLead(leadId: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const sales = await db.sale.findMany({
    where: { leadId, tenantId },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { soldAt: "desc" },
  });

  return sales.map(serializeSale);
}

export async function updateSale(tenantId: string, data: z.infer<typeof updateSaleSchema>) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const d = updateSaleSchema.parse(data);
  const sale = await db.sale.findFirst({
    where: { id: d.saleId, tenantId },
    select: { id: true, opportunityId: true, leadId: true },
  });
  if (!sale) throw new Error("Venda não encontrada.");

  await db.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        amount: d.amount ?? undefined,
        soldAt: d.soldAt ?? undefined,
        assignedToId: d.assignedToId ?? undefined,
        productOrService: d.productOrService?.trim() || undefined,
      },
    });

    const amount = d.amount ?? undefined;
    await tx.opportunity.update({
      where: { id: sale.opportunityId },
      data: {
        value: amount ?? undefined,
        productOrService: d.productOrService?.trim() || undefined,
        assignedToId: d.assignedToId ?? undefined,
      },
    });

    const total = await tx.opportunity.aggregate({
      where: { tenantId, leadId: sale.leadId },
      _sum: { value: true },
    });

    await tx.lead.update({
      where: { id: sale.leadId },
      data: { dealValue: total._sum.value ?? 0 },
    });
  });
}

export async function registerSale(tenantId: string, data: z.infer<typeof registerSaleSchema>) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const d = registerSaleSchema.parse(data);
  const p = await getPipelineWithStages(tenantId);
  const ganhoStage = p?.stages.find(
    (s) => (s.isSystemStage && (s.name || "").toLowerCase().includes("ganho")) || (s.name || "").toLowerCase().includes("ganho")
  );
  const stageId = ganhoStage?.id ?? p?.stages[0]?.id;
  if (!stageId) throw new Error("Pipeline sem etapas.");

  const soldAt = d.soldAt ?? new Date();

  const result = await db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({
      where: { id: d.leadId, tenantId, deletedAt: null },
      select: { name: true, campaign: true, assignedToId: true },
    });
    if (!lead) throw new Error("Lead não encontrado.");

    const opportunity = await tx.opportunity.create({
      data: {
        tenantId,
        leadId: d.leadId,
        name: `Venda - ${lead.name}`,
        value: d.amount,
        stageId,
        probability: 100,
        assignedToId: d.assignedToId ?? lead.assignedToId ?? undefined,
        expectedCloseAt: soldAt,
        campaign: lead.campaign ?? undefined,
        productOrService: d.productOrService?.trim() || undefined,
        status: "WON",
        wonAt: soldAt,
      },
    });

    const sale = await tx.sale.create({
      data: {
        tenantId,
        leadId: d.leadId,
        opportunityId: opportunity.id,
        amount: d.amount,
        productOrService: d.productOrService?.trim() || undefined,
        soldAt,
        assignedToId: d.assignedToId ?? lead.assignedToId ?? undefined,
        campaign: lead.campaign ?? undefined,
      },
    });

    const total = await tx.opportunity.aggregate({
      where: { tenantId, leadId: d.leadId },
      _sum: { value: true },
    });

    await tx.lead.update({
      where: { id: d.leadId },
      data: {
        dealValue: total._sum.value ?? 0,
        stageId,
        status: "WON",
      },
    });

    return { sale, leadName: lead.name };
  });

  // Cria transação financeira automaticamente
  try {
    await createTransactionFromSale(
      tenantId,
      result.sale.id,
      result.leadName,
      d.amount,
      soldAt
    );
  } catch (error) {
    console.error("Erro ao criar transação financeira:", error);
  }
}

export async function registerSaleFromForm(formData: FormData) {
  const { tenantId } = await getResolvedTenantId();
  if (!tenantId) throw new Error("Não autorizado");

  const leadId = (formData.get("leadId") as string)?.trim();
  const amountRaw = formData.get("amount");
  const productOrService = (formData.get("productOrService") as string)?.trim() || undefined;
  const soldAtRaw = (formData.get("soldAt") as string)?.trim() || undefined;
  const assignedToId = (formData.get("assignedToId") as string) || null;

  const amount =
    amountRaw === "" || amountRaw == null
      ? undefined
      : (() => {
          const raw = String(amountRaw).trim();
          const normalized = raw.includes(",")
            ? raw.replace(/\./g, "").replace(",", ".")
            : raw;
          const n = Number(normalized);
          return Number.isFinite(n) && n >= 0 ? n : undefined;
        })();

  if (!leadId || amount == null) return;

  await registerSale(tenantId, {
    leadId,
    amount,
    soldAt: soldAtRaw ? new Date(soldAtRaw) : undefined,
    assignedToId: assignedToId || undefined,
    productOrService,
  });

  redirect(`/dashboard/leads/${leadId}`);
}

export async function getLeadRevenueStats(leadId: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const sales = await db.sale.findMany({
    where: { leadId, tenantId },
    select: { amount: true, soldAt: true },
    orderBy: { soldAt: "desc" },
  });
  const total = sales.reduce((s, x) => s + Number(x.amount), 0);
  const count = sales.length;
  const ultima = sales[0]?.soldAt ?? null;
  const valorMedio = count > 0 ? total / count : null;
  return { totalComprado: total, numCompras: count, ultimaCompra: ultima, valorMedio };
}
