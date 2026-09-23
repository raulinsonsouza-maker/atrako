"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-server";
import { LeadSource } from "@prisma/client";
import { z } from "zod";

const DEFAULT_STAGES = [
  { name: "Novo", order: 0, color: "#94a3b8", probability: 10, isSystemStage: true },
  { name: "Contato", order: 1, color: "#3b82f6", probability: 25, isSystemStage: false },
  { name: "Proposta", order: 2, color: "#eab308", probability: 50, isSystemStage: false },
  { name: "Negociação", order: 3, color: "#f97316", probability: 75, isSystemStage: false },
  { name: "Ganho", order: 4, color: "#22c55e", probability: 100, isSystemStage: true },
  { name: "Perdido", order: 5, color: "#ef4444", probability: 0, isSystemStage: true },
];

function getStageProbability(stage: { name: string; probability?: number | null; isSystemStage?: boolean }): number {
  if (stage.probability != null) return Math.min(100, Math.max(0, stage.probability));
  const n = (stage.name || "").toLowerCase();
  if (stage.isSystemStage && n.includes("ganho")) return 100;
  if (stage.isSystemStage && n.includes("perdido")) return 0;
  if (n.includes("ganho")) return 100;
  if (n.includes("perdido")) return 0;
  if (n.includes("negoci")) return 75;
  if (n.includes("proposta")) return 50;
  if (n.includes("contato")) return 25;
  return 10;
}

function isWonStage(stage: { name: string; isSystemStage?: boolean }): boolean {
  const n = (stage.name || "").toLowerCase();
  return (stage.isSystemStage && n.includes("ganho")) || n.includes("ganho");
}

function isLostStage(stage: { name: string; isSystemStage?: boolean }): boolean {
  const n = (stage.name || "").toLowerCase();
  return (stage.isSystemStage && n.includes("perdido")) || n.includes("perdido");
}

export async function ensureDefaultPipeline(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  let pipeline = await db.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (pipeline && pipeline.stages.length > 0) return pipeline;

  if (!pipeline) {
    pipeline = await db.pipeline.create({
      data: { tenantId, name: "Vendas", isDefault: true },
      include: { stages: true },
    });
  }
  for (const s of DEFAULT_STAGES) {
    await db.leadStage.create({
      data: {
        tenantId,
        pipelineId: pipeline!.id,
        name: s.name,
        order: s.order,
        color: s.color,
        probability: s.probability,
        isSystemStage: s.isSystemStage,
      },
    });
  }
  return db.pipeline.findFirst({
    where: { id: pipeline!.id },
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

const createStageSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().min(3).max(20).optional(),
  probability: z.number().min(0).max(100).optional(),
});

export async function createLeadStage(tenantId: string, data: z.infer<typeof createStageSchema>) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const d = createStageSchema.parse(data);
  const pipeline = await getPipelineWithStages(tenantId);
  if (!pipeline) throw new Error("Pipeline não encontrado.");

  const maxOrder = pipeline.stages.reduce((acc, s) => Math.max(acc, s.order), 0);
  return db.leadStage.create({
    data: {
      tenantId,
      pipelineId: pipeline.id,
      name: d.name.trim(),
      order: maxOrder + 1,
      color: d.color?.trim() || "#94a3b8",
      probability: d.probability ?? undefined,
    },
  });
}

export async function getPipelineWithStages(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const p = await db.pipeline.findFirst({
    where: { tenantId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (p) return p;
  return ensureDefaultPipeline(tenantId);
}

export async function updateLeadStage(
  leadId: string,
  stageId: string,
  tenantId: string,
  opts?: { lossReason?: string }
) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const stage = await db.leadStage.findFirst({
    where: { id: stageId, tenantId },
    select: { name: true, isSystemStage: true },
  });
  if (!stage) throw new Error("Estágio não encontrado");
  
  let status: "WON" | "LOST" | undefined;
  if (isWonStage(stage)) status = "WON";
  else if (isLostStage(stage)) status = "LOST";

  const data: { stageId: string; status?: "WON" | "LOST"; lossReason?: string } = { stageId };
  if (status) data.status = status;
  if (opts?.lossReason != null) data.lossReason = opts.lossReason.trim().slice(0, 500) || undefined;

  await db.lead.updateMany({
    where: { id: leadId, tenantId },
    data,
  });
}

export async function getLeadsForPipeline(
  tenantId: string,
  opts?: { stageId?: string; source?: LeadSource; q?: string }
) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const p = await getPipelineWithStages(tenantId);
  if (!p) return { stages: [] };

  const where: Record<string, unknown> = { tenantId, deletedAt: null };
  if (opts?.stageId) where.stageId = opts.stageId;
  if (opts?.source) where.source = opts.source;
  if (opts?.q?.trim()) {
    where.OR = [
      { name: { contains: opts.q, mode: "insensitive" } },
      { email: { contains: opts.q, mode: "insensitive" } },
      { phone: { contains: opts.q, mode: "insensitive" } },
      { campaign: { contains: opts.q, mode: "insensitive" } },
      { ad: { contains: opts.q, mode: "insensitive" } },
    ];
  }

  const leads = await db.lead.findMany({
    where,
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  const byStage = new Map<string, typeof leads>();
  for (const s of p.stages) byStage.set(s.id, []);
  const firstId = p.stages[0]?.id;
  const leadStageMap = new Map<string, string>();
  for (const l of leads) {
    const sid = l.stageId || firstId;
    if (sid) leadStageMap.set(l.id, sid);
    if (sid) byStage.get(sid)?.push(l);
  }

  const openOpps = leads.length
    ? await db.opportunity.findMany({
        where: { tenantId, status: "OPEN", leadId: { in: leads.map((l) => l.id) } },
        select: { leadId: true, value: true },
      })
    : [];
  const negotiationByStage = new Map<string, number>();
  for (const o of openOpps) {
    const sid = leadStageMap.get(o.leadId) || firstId;
    if (!sid) continue;
    const prev = negotiationByStage.get(sid) ?? 0;
    negotiationByStage.set(sid, prev + Number(o.value ?? 0));
  }

  const serializeLead = (l: (typeof leads)[number]) => ({
    ...l,
    dealValue: l.dealValue != null ? Number(l.dealValue) : null,
  });

  const stages = p.stages.map((s) => {
    const list = (byStage.get(s.id) ?? []).map(serializeLead);
    const totalValue = list.reduce((sum, l) => sum + (l.dealValue ?? 0), 0);
    const negotiationValue = negotiationByStage.get(s.id) ?? 0;
    return { ...s, leads: list, totalCount: list.length, totalValue, negotiationValue };
  });
  const totalCount = stages.reduce((sum, s) => sum + s.totalCount, 0);
  const totalValue = stages.reduce((sum, s) => sum + s.totalValue, 0);
  const totalNegotiationValue = stages.reduce((sum, s) => sum + s.negotiationValue, 0);

  return { stages, totalCount, totalValue, totalNegotiationValue };
}

export async function getOpportunitiesForPipeline(tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const p = await getPipelineWithStages(tenantId);
  if (!p) return { stages: [] };

  const opportunities = await db.opportunity.findMany({
    where: { tenantId, status: "OPEN" },
    include: { stage: true, assignedTo: { select: { id: true, name: true } }, lead: { select: { id: true, name: true } } },
  });

  const byStage = new Map<string, typeof opportunities>();
  for (const s of p.stages) byStage.set(s.id, []);
  const firstId = p.stages[0]?.id;
  for (const o of opportunities) {
    const sid = o.stageId || firstId;
    if (sid) byStage.get(sid)?.push(o);
  }

  return {
    stages: p.stages.map((s) => {
      const list = byStage.get(s.id) ?? [];
      const total = list.reduce((a, o) => a + Number(o.value), 0);
      const ponderado = list.reduce((a, o) => {
        const prob = o.probability != null ? o.probability : getStageProbability(s);
        return a + Number(o.value) * (prob / 100);
      }, 0);
      return { ...s, opportunities: list, totalValor: total, valorPonderado: ponderado };
    }),
  };
}

export async function updateOpportunityStage(opportunityId: string, stageId: string, tenantId: string, opts?: { lossReason?: string }) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const stage = await db.leadStage.findFirst({
    where: { id: stageId, tenantId },
    select: { name: true, isSystemStage: true },
  });
  if (!stage) throw new Error("Estágio não encontrado");

  const o = await db.opportunity.findFirst({ where: { id: opportunityId, tenantId, status: "OPEN" } });
  if (!o) throw new Error("Oportunidade não encontrada ou já encerrada.");

  if (isWonStage(stage)) {
    const { setWon } = await import("./opportunity");
    return setWon(opportunityId, tenantId);
  }
  if (isLostStage(stage)) {
    const { setLost } = await import("./opportunity");
    return setLost(opportunityId, tenantId, { lossReason: opts?.lossReason });
  }

  await db.opportunity.updateMany({
    where: { id: opportunityId, tenantId },
    data: { stageId },
  });
}

const updateStageConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().min(3).max(20).optional(),
  probability: z.number().min(0).max(100).optional(),
  order: z.number().int().optional(),
});

export async function updateLeadStageConfig(
  id: string,
  tenantId: string,
  data: z.infer<typeof updateStageConfigSchema>
) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const stage = await db.leadStage.findFirst({
    where: { id, tenantId },
    select: { isSystemStage: true, name: true },
  });

  if (!stage) throw new Error("Estágio não encontrado");

  const d = updateStageConfigSchema.parse(data);
  const updateData: {
    name?: string;
    color?: string;
    probability?: number | null;
    order?: number;
  } = {};

  // Estágios fixos: não permitir alterar nome
  if (stage.isSystemStage && d.name !== undefined) {
    throw new Error("Não é possível alterar o nome de estágios fixos do sistema");
  }

  if (d.name !== undefined) updateData.name = d.name.trim();
  if (d.color !== undefined) updateData.color = d.color.trim();
  if (d.probability !== undefined) updateData.probability = d.probability;
  if (d.order !== undefined) updateData.order = d.order;

  return db.leadStage.updateMany({
    where: { id, tenantId },
    data: updateData,
  });
}

export async function deleteLeadStage(id: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const stage = await db.leadStage.findFirst({
    where: { id, tenantId },
    select: { isSystemStage: true, name: true },
  });

  if (!stage) throw new Error("Estágio não encontrado");

  // Não permitir excluir estágios fixos
  if (stage.isSystemStage) {
    throw new Error("Não é possível excluir estágios fixos do sistema");
  }

  // Verificar se há leads ou opportunities usando este estágio
  const [leadsCount, opportunitiesCount] = await Promise.all([
    db.lead.count({ where: { tenantId, stageId: id, deletedAt: null } }),
    db.opportunity.count({ where: { tenantId, stageId: id, status: "OPEN" } }),
  ]);

  if (leadsCount > 0 || opportunitiesCount > 0) {
    // Buscar estágio "Novo" para mover os registros
    const novoStage = await db.leadStage.findFirst({
      where: { tenantId, isSystemStage: true, name: { contains: "Novo", mode: "insensitive" } },
      select: { id: true },
    });

    if (!novoStage) {
      throw new Error("Não é possível excluir: estágio em uso e estágio 'Novo' não encontrado");
    }

    // Mover leads e opportunities para "Novo"
    await Promise.all([
      db.lead.updateMany({
        where: { tenantId, stageId: id, deletedAt: null },
        data: { stageId: novoStage.id },
      }),
      db.opportunity.updateMany({
        where: { tenantId, stageId: id, status: "OPEN" },
        data: { stageId: novoStage.id },
      }),
    ]);
  }

  return db.leadStage.deleteMany({
    where: { id, tenantId },
  });
}

export async function reorderStages(tenantId: string, stageIds: string[]) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  const tid = (session.user as { tenantId?: string | null }).tenantId;
  if (tid !== tenantId) throw new Error("Tenant inválido");

  const pipeline = await getPipelineWithStages(tenantId);
  if (!pipeline) throw new Error("Pipeline não encontrado");

  // Validar que todos os IDs pertencem ao tenant
  const validStageIds = new Set(pipeline.stages.map((s) => s.id));
  if (!stageIds.every((id) => validStageIds.has(id)) || stageIds.length !== validStageIds.size) {
    throw new Error("IDs de estágios inválidos");
  }

  // Validar posições de estágios fixos
  const novoStage = pipeline.stages.find((s) => s.isSystemStage && s.name.toLowerCase().includes("novo"));
  const ganhoStage = pipeline.stages.find((s) => s.isSystemStage && s.name.toLowerCase().includes("ganho"));
  const perdidoStage = pipeline.stages.find((s) => s.isSystemStage && s.name.toLowerCase().includes("perdido"));

  if (novoStage && stageIds[0] !== novoStage.id) {
    throw new Error("O estágio 'Novo' deve ser o primeiro");
  }

  if (ganhoStage && perdidoStage) {
    const ganhoIndex = stageIds.indexOf(ganhoStage.id);
    const perdidoIndex = stageIds.indexOf(perdidoStage.id);
    const lastIndex = stageIds.length - 1;

    // Verificar se ambos estão nas duas últimas posições (em qualquer ordem)
    const isGanhoLast = ganhoIndex === lastIndex || ganhoIndex === lastIndex - 1;
    const isPerdidoLast = perdidoIndex === lastIndex || perdidoIndex === lastIndex - 1;

    if (!isGanhoLast || !isPerdidoLast) {
      throw new Error("Os estágios 'Ganho' e 'Perdido' devem ser os dois últimos");
    }
  }

  // Atualizar ordem de todos os estágios
  await Promise.all(
    stageIds.map((stageId, index) =>
      db.leadStage.updateMany({
        where: { id: stageId, tenantId },
        data: { order: index },
      })
    )
  );

  return getPipelineWithStages(tenantId);
}
