"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertTenantAccess, getResolvedTenantId } from "@/lib/dashboard-context";
import { z } from "zod";
import { LeadSource, LeadStatus } from "@prisma/client";
import { executeAutomations } from "./automation";
import { recordStageEntry } from "./stageHistory";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  campaign: z.string().max(255).optional(),
  ad: z.string().max(255).optional(),
  dealValue: z.number().nonnegative().optional(),
});

const updateSchema = createSchema.partial().extend({
  assignedToId: z.string().uuid().nullable().optional(),
  stageId: z.string().uuid().nullable().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  lossReason: z.string().max(500).optional(),
  lossReasonId: z.string().uuid().nullable().optional(),
});

// Helper para converter Decimal do Prisma para Number (serialização para Client Components)
function serializeLead<T extends { dealValue?: unknown }>(lead: T): T & { dealValue: number | null } {
  return {
    ...lead,
    dealValue: lead.dealValue != null ? Number(lead.dealValue) : null,
  };
}

export async function listLeads(
  tenantId: string,
  opts?: { stageId?: string; source?: LeadSource; assignedToId?: string | null; q?: string; tagId?: string }
) {
  await assertTenantAccess(tenantId);

  const where: Record<string, unknown> = { tenantId, deletedAt: null };
  if (opts?.stageId) where.stageId = opts.stageId;
  if (opts?.source) where.source = opts.source;
  if (opts?.assignedToId !== undefined) where.assignedToId = opts.assignedToId;
  if (opts?.tagId) {
    where.tags = {
      some: {
        tagId: opts.tagId,
      },
    };
  }
  if (opts?.q?.trim()) {
    where.OR = [
      { name: { contains: opts.q, mode: "insensitive" } },
      { email: { contains: opts.q, mode: "insensitive" } },
      { phone: { contains: opts.q, mode: "insensitive" } },
    ];
  }

  const leads = await db.lead.findMany({
    where,
    include: {
      stage: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      tags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return leads.map(serializeLead);
}

export async function getLead(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  const lead = await db.lead.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      stage: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  return lead ? serializeLead(lead) : null;
}

async function getFirstStageId(tenantId: string): Promise<string | null> {
  const pipe = await db.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" }, take: 1 } },
  });
  return pipe?.stages[0]?.id ?? null;
}

export async function createLead(tenantId: string, data: z.infer<typeof createSchema>) {
  await assertTenantAccess(tenantId);

  const d = createSchema.parse(data);
  const [tenant, firstStageId] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { config: true } }),
    getFirstStageId(tenantId),
  ]);
  const cfg = (tenant?.config as { autoAssignUserId?: string } | null) || {};
  const assignedToId = cfg.autoAssignUserId ?? null;

  const lead = await db.lead.create({
    data: {
      tenantId,
      name: d.name,
      email: d.email,
      phone: d.phone ?? null,
      source: d.source ?? "MANUAL",
      status: "NEW",
      stageId: firstStageId,
      campaign: d.campaign ?? null,
      ad: d.ad ?? null,
      dealValue: d.dealValue != null ? d.dealValue : undefined,
      assignedToId: assignedToId || undefined,
    },
  });

  // Ponte Atrako: lead único no CRM central
  const workspaceId = process.env.ATRAKO_WORKSPACE_ID?.trim() || tenantId;
  void import("@/lib/atrako-bridge")
    .then(({ publishLeadCreated }) =>
      publishLeadCreated({
        workspaceId,
        leadId: lead.id,
        payload: {
          nome: lead.name,
          email: lead.email,
          telefone: lead.phone,
          fonte: lead.source,
          valor: d.dealValue ?? null,
        },
      }),
    )
    .catch(() => null);

  // Executar automações para lead criado
  executeAutomations(tenantId, "LEAD_CREATED", {
    leadId: lead.id,
    source: d.source ?? "MANUAL",
    stageId: firstStageId || undefined,
    assignedToId: assignedToId || null,
  }).catch((error) => {
    console.error("[Lead] Erro ao executar automações:", error);
  });

  return lead;
}

export async function updateLead(id: string, tenantId: string, data: z.infer<typeof updateSchema>) {
  await assertTenantAccess(tenantId);

  // Buscar lead atual para comparar mudanças
  const currentLead = await db.lead.findFirst({
    where: { id, tenantId, deletedAt: null },
    select: { stageId: true, status: true, assignedToId: true },
  });

  const d = updateSchema.parse(data);
  await db.lead.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: d as Record<string, unknown>,
  });

  // Registrar mudança de stage no histórico
  if (d.stageId !== undefined && currentLead?.stageId !== d.stageId) {
    recordStageEntry(tenantId, id, d.stageId || null, currentLead?.stageId || null).catch(
      (error) => {
        console.error("[Lead] Erro ao registrar mudança de stage:", error);
      }
    );
  }

  // Executar automações baseadas nas mudanças
  const promises: Promise<unknown>[] = [];

  if (d.stageId !== undefined && currentLead?.stageId !== d.stageId) {
    promises.push(
      executeAutomations(tenantId, "LEAD_STAGE_CHANGED", {
        leadId: id,
        stageId: d.stageId || undefined,
        previousStageId: currentLead?.stageId || undefined,
      }).catch((error) => {
        console.error("[Lead] Erro ao executar automações de mudança de stage:", error);
      })
    );
  }

  if (d.status !== undefined && currentLead?.status !== d.status) {
    promises.push(
      executeAutomations(tenantId, "LEAD_STATUS_CHANGED", {
        leadId: id,
        status: d.status || undefined,
        previousStatus: currentLead?.status || undefined,
      }).catch((error) => {
        console.error("[Lead] Erro ao executar automações de mudança de status:", error);
      })
    );
  }

  if (d.assignedToId !== undefined && currentLead?.assignedToId !== d.assignedToId) {
    promises.push(
      executeAutomations(tenantId, "LEAD_ASSIGNED", {
        leadId: id,
        assignedToId: d.assignedToId || null,
        previousAssignedToId: currentLead?.assignedToId || null,
      }).catch((error) => {
        console.error("[Lead] Erro ao executar automações de atribuição:", error);
      })
    );
  }

  // Executar em paralelo sem esperar
  Promise.all(promises).catch(() => {
    // Erros já foram logados individualmente
  });
}

export async function deleteLead(id: string, tenantId: string) {
  await assertTenantAccess(tenantId);

  await db.lead.updateMany({
    where: { id, tenantId },
    data: { deletedAt: new Date() },
  });
}

export async function assignLead(leadId: string, tenantId: string, userId: string | null) {
  await assertTenantAccess(tenantId);

  await db.lead.updateMany({
    where: { id: leadId, tenantId },
    data: { assignedToId: userId },
  });
}

export async function listUsers(tenantId: string) {
  await assertTenantAccess(tenantId);

  return db.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function createLeadFromForm(formData: FormData) {
  const { tenantId } = await getResolvedTenantId();
  if (!tenantId) throw new Error("Não autorizado");

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const source = (formData.get("source") as LeadSource) || "MANUAL";
  const campaign = (formData.get("campaign") as string)?.trim() || undefined;
  const ad = (formData.get("ad") as string)?.trim() || undefined;
  if (!name || !email) return;

  await createLead(tenantId, { name, email, phone: phone || undefined, source, campaign, ad });
  redirect("/dashboard/leads");
}

export async function updateLeadFromForm(formData: FormData) {
  const { tenantId } = await getResolvedTenantId();
  if (!tenantId) throw new Error("Não autorizado");

  const id = (formData.get("id") as string)?.trim();
  if (!id) return;

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const source = (formData.get("source") as LeadSource) || "MANUAL";
  const assignedToId = (formData.get("assignedToId") as string) || null;
  const campaign = (formData.get("campaign") as string)?.trim() || undefined;
  const ad = (formData.get("ad") as string)?.trim() || undefined;
  const lossReason = (formData.get("lossReason") as string)?.trim() || undefined;
  const dealValueRaw = formData.get("dealValue");
  const dealValue =
    dealValueRaw === "" || dealValueRaw == null
      ? undefined
      : (() => {
          const n = Number(String(dealValueRaw).replace(",", "."));
          return Number.isFinite(n) && n >= 0 ? n : undefined;
        })();
  if (!name || !email) return;

  const lossReasonId = (formData.get("lossReasonId") as string)?.trim() || null;

  await updateLead(id, tenantId, {
    name,
    email,
    phone: phone || undefined,
    source,
    assignedToId: assignedToId || null,
    campaign,
    ad,
    lossReason,
    lossReasonId: lossReasonId || null,
    dealValue,
  });
  redirect(`/dashboard/leads/${id}`);
}

/** Atualiza o lead sem redirecionar. Retorna o lead atualizado. */
export async function updateLeadNoRedirect(
  id: string,
  tenantId: string,
  data: z.infer<typeof updateSchema>
) {
  await updateLead(id, tenantId, data);
  return getLead(id, tenantId);
}
