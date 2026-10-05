/**
 * CRM nativo — leads do workspace (NativeLead + Person hub).
 */

import { prisma } from "@/lib/db";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { withStageHistory } from "@/lib/crm/stage-history";

export const STAGE_ROLE_ENTRY = "ENTRY";
export const STAGE_ROLE_WON = "WON";
/** Criada sob demanda no primeiro carrinho abandonado; depois fica fixa logo após Novo. */
export const STAGE_ROLE_ABANDONED = "ABANDONED";
/** Criada sob demanda (pedido expirado / reembolso); fica fixa depois de Ganho. */
export const STAGE_ROLE_LOST = "LOST";

export type StageRole = "ENTRY" | "WON" | "ABANDONED" | "LOST";

function isFixedRole(role: string | null | undefined) {
  return (
    role === STAGE_ROLE_ENTRY ||
    role === STAGE_ROLE_WON ||
    role === STAGE_ROLE_ABANDONED ||
    role === STAGE_ROLE_LOST
  );
}

/** Colunas base do funil Atrako. ENTRY / WON são papéis fixos; nomes editáveis. */
export const ATRAKO_BASE_STAGES = [
  { name: "Novo", order: 0, color: "#8E8E93", role: STAGE_ROLE_ENTRY as string },
  { name: "Qualificado", order: 1, color: "#0066cc", role: null as string | null },
  { name: "Em conversa", order: 2, color: "#0071e3", role: null },
  { name: "Proposta", order: 3, color: "#FF9500", role: null },
  { name: "Negociação", order: 4, color: "#AF52DE", role: null },
  { name: "Ganho", order: 5, color: "#34C759", role: STAGE_ROLE_WON as string },
] as const;

type StageRow = {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  color: string | null;
  role?: string | null;
};

const STAGE_COLOR_DEFAULT = "#8E8E93";
const FIXED_ENTRY_NAME = "Novo";
const FIXED_WON_NAME = "Ganho";
const FIXED_ABANDONED_NAME = "Carrinho abandonado";
const ABANDONED_STAGE_COLOR = "#FF9500";
const FIXED_LOST_NAME = "Perdido";
const LOST_STAGE_COLOR = "#FF3B30";

/**
 * Prisma client no Windows pode ficar sem o campo `role` até reiniciar o
 * `next dev` + `prisma generate`. Operações de role vão por SQL bruto.
 */
async function loadStages(pipelineId: string): Promise<StageRow[]> {
  return prisma.$queryRaw<StageRow[]>`
    SELECT id, "pipelineId", name, "order", color, role
    FROM "CrmStage"
    WHERE "pipelineId" = ${pipelineId}
    ORDER BY "order" ASC
  `;
}

async function setStageRole(id: string, role: string, name?: string) {
  if (name) {
    await prisma.$executeRaw`
      UPDATE "CrmStage" SET "role" = ${role}, "name" = ${name} WHERE id = ${id}
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "CrmStage" SET "role" = ${role} WHERE id = ${id}
    `;
  }
}

async function createStageRow(data: {
  pipelineId: string;
  name: string;
  order: number;
  color: string;
  role?: string | null;
}): Promise<StageRow> {
  const created = await prisma.crmStage.create({
    data: {
      pipelineId: data.pipelineId,
      name: data.name,
      order: data.order,
      color: data.color,
    },
  });
  if (data.role) {
    await setStageRole(created.id, data.role);
  }
  return {
    id: created.id,
    pipelineId: created.pipelineId,
    name: created.name,
    order: created.order,
    color: created.color,
    role: data.role ?? null,
  };
}

type PipelineWithStages = Awaited<ReturnType<typeof loadDefaultPipeline>>;

async function loadDefaultPipeline(clienteId: string) {
  const pipeline = await prisma.crmPipeline.findFirst({
    where: { clienteId, isDefault: true },
  });
  if (!pipeline) return null;
  const stages = await loadStages(pipeline.id);
  return {
    id: pipeline.id,
    clienteId: pipeline.clienteId,
    stages,
  };
}

/** Garante pipeline + colunas base; Novo (ENTRY) e Ganho (WON) sempre fixos. */
export async function ensureDefaultPipeline(clienteId: string) {
  let pipeline = await loadDefaultPipeline(clienteId);

  if (!pipeline) {
    const created = await prisma.crmPipeline.create({
      data: {
        clienteId,
        name: "Principal",
        isDefault: true,
        stages: {
          create: ATRAKO_BASE_STAGES.map((s) => ({
            name: s.name,
            order: s.order,
            color: s.color,
          })),
        },
      },
    });
    for (const s of ATRAKO_BASE_STAGES) {
      if (!s.role) continue;
      await prisma.$executeRaw`
        UPDATE "CrmStage"
        SET "role" = ${s.role}
        WHERE "pipelineId" = ${created.id} AND "name" = ${s.name} AND "role" IS NULL
      `;
    }
    return (await loadDefaultPipeline(clienteId))!;
  }

  return ensureEssentialStages(pipeline);
}

async function ensureEssentialStages(pipeline: NonNullable<PipelineWithStages>) {
  let stages = [...pipeline.stages];
  let entry = stages.find((s) => s.role === STAGE_ROLE_ENTRY);
  let won = stages.find((s) => s.role === STAGE_ROLE_WON);

  if (!entry) {
    const byName = stages.find((s) => /^(novo|new|entrada)$/i.test(s.name));
    if (byName) {
      await setStageRole(byName.id, STAGE_ROLE_ENTRY, byName.name);
      entry = { ...byName, role: STAGE_ROLE_ENTRY };
    } else {
      entry = await createStageRow({
        pipelineId: pipeline.id,
        name: FIXED_ENTRY_NAME,
        order: 0,
        color: ATRAKO_BASE_STAGES[0].color,
        role: STAGE_ROLE_ENTRY,
      });
    }
  }

  if (!won) {
    const byName = stages.find((s) => /^(ganho|ganhos|won|fechado)$/i.test(s.name));
    if (byName) {
      await setStageRole(byName.id, STAGE_ROLE_WON, byName.name);
      won = { ...byName, role: STAGE_ROLE_WON };
    } else {
      const maxOrder = stages.reduce((m, s) => Math.max(m, s.order), -1);
      won = await createStageRow({
        pipelineId: pipeline.id,
        name: FIXED_WON_NAME,
        order: maxOrder + 1,
        color: ATRAKO_BASE_STAGES[ATRAKO_BASE_STAGES.length - 1].color,
        role: STAGE_ROLE_WON,
      });
    }
  }

  // Seed colunas intermediárias base (cria as que faltarem por nome)
  stages = (await loadDefaultPipeline(pipeline.clienteId))?.stages ?? stages;
  const middle = stages.filter((s) => !isFixedRole(s.role));
  const baseMiddle = ATRAKO_BASE_STAGES.filter((s) => !s.role);
  const existingNames = new Set(stages.map((s) => s.name.toLowerCase()));

  if (middle.length === 0) {
    for (const s of baseMiddle) {
      await createStageRow({
        pipelineId: pipeline.id,
        name: s.name,
        order: s.order,
        color: s.color,
        role: null,
      });
    }
  } else {
    for (const s of baseMiddle) {
      if (existingNames.has(s.name.toLowerCase())) continue;
      const current = await loadStages(pipeline.id);
      const wonOrder =
        current.find((row) => row.role === STAGE_ROLE_WON)?.order ?? current.length;
      const toShift = current
        .filter((row) => row.order >= wonOrder)
        .sort((a, b) => b.order - a.order);
      for (const row of toShift) {
        await prisma.crmStage.update({
          where: { id: row.id },
          data: { order: row.order + 1 },
        });
      }
      await createStageRow({
        pipelineId: pipeline.id,
        name: s.name,
        order: wonOrder,
        color: s.color,
        role: null,
      });
      existingNames.add(s.name.toLowerCase());
    }
  }

  return normalizeStageOrder(pipeline.clienteId);
}

function stageRank(role: string | null | undefined) {
  if (role === STAGE_ROLE_ENTRY) return 0;
  if (role === STAGE_ROLE_ABANDONED) return 1;
  if (role === STAGE_ROLE_WON) return 3;
  if (role === STAGE_ROLE_LOST) return 4;
  return 2;
}

/** Novo = 0, Carrinho abandonado = 1 (se existir), livres, Ganho, Perdido (se existir). */
async function normalizeStageOrder(clienteId: string) {
  const fresh = await loadDefaultPipeline(clienteId);
  if (!fresh) throw new Error("Pipeline não encontrado");
  const sorted = [...fresh.stages].sort(
    (a, b) => stageRank(a.role) - stageRank(b.role) || a.order - b.order,
  );
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].order !== i) {
      await prisma.crmStage.update({
        where: { id: sorted[i].id },
        data: { order: i },
      });
    }
  }

  const final = await loadDefaultPipeline(clienteId);
  if (!final) throw new Error("Pipeline não encontrado");
  return final;
}

/** Garante a coluna "Carrinho abandonado" (reaproveita uma coluna livre com esse nome). */
export async function ensureAbandonedStage(clienteId: string) {
  const pipeline = await ensureDefaultPipeline(clienteId);
  const existing = pipeline.stages.find((s) => s.role === STAGE_ROLE_ABANDONED);
  if (existing) return existing;

  const byName = pipeline.stages.find(
    (s) => !isFixedRole(s.role) && /carrinho\s+abandonado|abandon/i.test(s.name),
  );
  if (byName) {
    await setStageRole(byName.id, STAGE_ROLE_ABANDONED, byName.name);
  } else {
    await createStageRow({
      pipelineId: pipeline.id,
      name: FIXED_ABANDONED_NAME,
      order: 1,
      color: ABANDONED_STAGE_COLOR,
      role: STAGE_ROLE_ABANDONED,
    });
  }
  const final = await normalizeStageOrder(clienteId);
  return final.stages.find((s) => s.role === STAGE_ROLE_ABANDONED)!;
}

export function isAbandonedStage(stage: { role?: string | null } | null) {
  return stage?.role === STAGE_ROLE_ABANDONED;
}

/** Garante a coluna "Perdido" (reaproveita uma coluna livre com esse nome). */
export async function ensureLostStage(clienteId: string) {
  const pipeline = await ensureDefaultPipeline(clienteId);
  const existing = pipeline.stages.find((s) => s.role === STAGE_ROLE_LOST);
  if (existing) return existing;

  const byName = pipeline.stages.find(
    (s) => !isFixedRole(s.role) && /^(perdido|perdidos|lost)$/i.test(s.name.trim()),
  );
  if (byName) {
    await setStageRole(byName.id, STAGE_ROLE_LOST, byName.name);
  } else {
    await createStageRow({
      pipelineId: pipeline.id,
      name: FIXED_LOST_NAME,
      order: 999,
      color: LOST_STAGE_COLOR,
      role: STAGE_ROLE_LOST,
    });
  }
  const final = await normalizeStageOrder(clienteId);
  return final.stages.find((s) => s.role === STAGE_ROLE_LOST)!;
}

export function isLostStage(stage: { role?: string | null } | null) {
  return stage?.role === STAGE_ROLE_LOST;
}

export function isWonStage(stage: { role?: string | null; name?: string | null } | null) {
  if (!stage) return false;
  if (stage.role === STAGE_ROLE_WON) return true;
  return stage.name?.toLowerCase() === "ganho";
}

export function isEntryStage(stage: { role?: string | null; name?: string | null } | null) {
  if (!stage) return false;
  if (stage.role === STAGE_ROLE_ENTRY) return true;
  return stage.name?.toLowerCase() === "novo";
}

export async function listNativeLeads(clienteId: string) {
  return prisma.nativeLead.findMany({
    where: { clienteId },
    include: { contact: true, stage: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function createNativeLead(input: {
  clienteId: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  const { lead } = await upsertPersonAndLead({
    workspaceId: input.clienteId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    source: input.source ?? "manual",
    metadata: input.metadata ?? null,
  });
  return lead;
}

/** Cards carregados por coluna; contagem e valor da coluna são sempre do total. */
const PIPELINE_LEADS_PER_STAGE = 100;

export async function getPipelineBoard(clienteId: string, opts?: { q?: string; source?: string }) {
  const pipeline = await ensureDefaultPipeline(clienteId);
  const q = opts?.q?.trim().toLowerCase();
  const source = opts?.source?.trim();

  const where = {
    clienteId,
    ...(source ? { source: { equals: source, mode: "insensitive" as const } } : {}),
    ...(q
      ? {
          OR: [
            { contact: { name: { contains: q, mode: "insensitive" as const } } },
            { contact: { email: { contains: q, mode: "insensitive" as const } } },
            { contact: { phone: { contains: q } } },
          ],
        }
      : {}),
  };

  const [byStage, byStatus, newThisWeek, bySource] = await Promise.all([
    prisma.nativeLead.groupBy({
      by: ["stageId"],
      where,
      _count: { _all: true },
      _sum: { dealValue: true },
    }),
    prisma.nativeLead.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.nativeLead.count({
      where: { ...where, createdAt: { gt: new Date(Date.now() - 7 * 86400000) } },
    }),
    prisma.nativeLead.groupBy({ by: ["source"], where: { clienteId }, _count: { _all: true } }),
  ]);
  const sources = bySource
    .filter((r) => r.source)
    .map((r) => ({ value: r.source as string, count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  const statsFor = (stageId: string | null) => {
    const row = byStage.find((r) => r.stageId === stageId);
    return {
      totalCount: row?._count._all ?? 0,
      totalValue: row?._sum.dealValue != null ? Number(row._sum.dealValue) : 0,
    };
  };
  const leadsFor = (stageId: string | null) =>
    prisma.nativeLead.findMany({
      where: { ...where, stageId },
      include: { contact: true },
      orderBy: { updatedAt: "desc" },
      take: PIPELINE_LEADS_PER_STAGE,
    });

  const stages = await Promise.all(
    pipeline.stages.map(async (stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color || STAGE_COLOR_DEFAULT,
      order: stage.order,
      role: (stage.role as StageRole | null) ?? null,
      ...statsFor(stage.id),
      leads: (await leadsFor(stage.id)).map((l) => mapLead(l)),
    })),
  );

  const unstagedStats = statsFor(null);
  if (unstagedStats.totalCount) {
    stages.unshift({
      id: "_none",
      name: "Sem etapa",
      color: "#AEAEB2",
      order: -1,
      role: null,
      ...unstagedStats,
      leads: (await leadsFor(null)).map((l) => mapLead(l)),
    });
  }

  const wonStageIds = new Set(pipeline.stages.filter((s) => isWonStage(s)).map((s) => s.id));
  const statusCount = (status: string) =>
    byStatus.find((r) => r.status === status)?._count._all ?? 0;

  return {
    pipelineId: pipeline.id,
    stages,
    sources,
    totalCount: byStage.reduce((sum, r) => sum + r._count._all, 0),
    totalValue: byStage.reduce(
      (sum, r) => sum + (r._sum.dealValue != null ? Number(r._sum.dealValue) : 0),
      0,
    ),
    newThisWeek,
    won: Math.max(
      statusCount("WON"),
      byStage
        .filter((r) => r.stageId && wonStageIds.has(r.stageId))
        .reduce((sum, r) => sum + r._count._all, 0),
    ),
    openCount: statusCount("OPEN"),
  };
}

function mapLead(l: {
  id: string;
  contactId: string | null;
  source: string | null;
  status: string;
  dealValue: { toString(): string } | number | null;
  stageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  contact: { name: string; email: string | null; phone: string | null } | null;
}) {
  return {
    id: l.id,
    contactId: l.contactId,
    name: l.contact?.name ?? "Sem nome",
    email: l.contact?.email ?? null,
    phone: l.contact?.phone ?? null,
    source: l.source,
    status: l.status,
    dealValue: l.dealValue != null ? Number(l.dealValue) : null,
    stageId: l.stageId,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export async function updateLeadStage(input: {
  workspaceId: string;
  leadId: string;
  stageId: string;
}) {
  const stage =
    input.stageId === "_none"
      ? null
      : await prisma.crmStage.findFirst({
          where: { id: input.stageId, pipeline: { clienteId: input.workspaceId } },
        });
  if (input.stageId !== "_none" && !stage) {
    throw new Error("Etapa inválida");
  }

  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
  });
  if (!lead) throw new Error("Lead não encontrado");

  const status = isWonStage(stage) ? "WON" : isLostStage(stage) ? "LOST" : "OPEN";
  const nextStageId = stage?.id ?? null;
  const meta =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};
  return prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      stageId: nextStageId,
      status,
      ...(nextStageId !== lead.stageId
        ? {
            metadata: withStageHistory(meta, {
              stageId: nextStageId,
              stage: stage?.name ?? null,
              role: (stage as { role?: string | null } | null)?.role ?? null,
              by: "manual",
            }) as never,
          }
        : {}),
    },
    include: { contact: true, stage: true },
  });
}

export async function createPipelineStage(input: {
  workspaceId: string;
  name: string;
  color?: string | null;
}) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Nome obrigatório");
  const pipeline = await ensureDefaultPipeline(input.workspaceId);
  const won = pipeline.stages.find((s) => s.role === STAGE_ROLE_WON);
  // Nova coluna sempre antes de Ganho (Ganho/Perdido fixos no fim)
  const insertOrder = won ? won.order : pipeline.stages.length;
  const toShift = [...pipeline.stages]
    .filter((s) => s.order >= insertOrder)
    .sort((a, b) => b.order - a.order);
  for (const s of toShift) {
    await prisma.crmStage.update({ where: { id: s.id }, data: { order: s.order + 1 } });
  }
  return createStageRow({
    pipelineId: pipeline.id,
    name,
    order: insertOrder,
    color: input.color?.trim() || STAGE_COLOR_DEFAULT,
    role: null,
  });
}

export async function updatePipelineStage(input: {
  workspaceId: string;
  stageId: string;
  name?: string;
  color?: string | null;
}) {
  const pipeline = await ensureDefaultPipeline(input.workspaceId);
  const stage = pipeline.stages.find((s) => s.id === input.stageId) ?? null;
  if (!stage) throw new Error("Etapa não encontrada");

  const data: { name?: string; color?: string | null } = {};

  if (typeof input.name === "string") {
    const name = input.name.trim().slice(0, 80);
    if (!name) throw new Error("Nome obrigatório");
    data.name = name;
  }
  if (input.color !== undefined) {
    data.color = input.color?.trim() || STAGE_COLOR_DEFAULT;
  }
  if (!Object.keys(data).length) return stage;

  const updated = await prisma.crmStage.update({
    where: { id: stage.id },
    data,
  });
  return { ...updated, role: stage.role ?? null };
}

/**
 * Salva o funil inteiro: etapas livres (ordem + nome + cor),
 * ENTRY/WON nas pontas com nomes editáveis; etapas removidas migram leads para entrada.
 */
export async function configurePipelineStages(input: {
  workspaceId: string;
  /** Só etapas livres (sem ENTRY/WON), na ordem desejada. */
  middle: Array<{ id?: string; name: string; color: string }>;
  entryName?: string;
  entryColor?: string;
  wonName?: string;
  wonColor?: string;
  abandonedName?: string;
  abandonedColor?: string;
  lostName?: string;
  lostColor?: string;
}) {
  const pipeline = await ensureDefaultPipeline(input.workspaceId);
  const entry = pipeline.stages.find((s) => s.role === STAGE_ROLE_ENTRY);
  const won = pipeline.stages.find((s) => s.role === STAGE_ROLE_WON);
  const abandoned = pipeline.stages.find((s) => s.role === STAGE_ROLE_ABANDONED);
  const lost = pipeline.stages.find((s) => s.role === STAGE_ROLE_LOST);
  if (!entry || !won) throw new Error("Funil incompleto");

  const middleInput = input.middle.map((s) => ({
    id: s.id?.trim() || undefined,
    name: s.name.trim().slice(0, 80),
    color: s.color.trim() || STAGE_COLOR_DEFAULT,
  }));
  for (const s of middleInput) {
    if (!s.name) throw new Error("Nome da etapa obrigatório");
  }

  const existingMiddle = pipeline.stages.filter((s) => !isFixedRole(s.role));
  const keepIds = new Set(middleInput.map((s) => s.id).filter(Boolean) as string[]);
  const toRemove = existingMiddle.filter((s) => !keepIds.has(s.id));

  for (const s of toRemove) {
    await prisma.nativeLead.updateMany({
      where: { clienteId: input.workspaceId, stageId: s.id },
      data: { stageId: entry.id, status: "OPEN" },
    });
    await prisma.crmStage.delete({ where: { id: s.id } });
  }

  const entryPatch: { name?: string; color?: string } = {};
  if (typeof input.entryName === "string" && input.entryName.trim()) {
    entryPatch.name = input.entryName.trim().slice(0, 80);
  }
  if (input.entryColor !== undefined) {
    entryPatch.color = input.entryColor.trim() || STAGE_COLOR_DEFAULT;
  }
  if (Object.keys(entryPatch).length) {
    await prisma.crmStage.update({ where: { id: entry.id }, data: entryPatch });
  }

  const wonPatch: { name?: string; color?: string } = {};
  if (typeof input.wonName === "string" && input.wonName.trim()) {
    wonPatch.name = input.wonName.trim().slice(0, 80);
  }
  if (input.wonColor !== undefined) {
    wonPatch.color = input.wonColor.trim() || STAGE_COLOR_DEFAULT;
  }
  if (Object.keys(wonPatch).length) {
    await prisma.crmStage.update({ where: { id: won.id }, data: wonPatch });
  }

  if (abandoned) {
    const abandonedPatch: { name?: string; color?: string } = {};
    if (typeof input.abandonedName === "string" && input.abandonedName.trim()) {
      abandonedPatch.name = input.abandonedName.trim().slice(0, 80);
    }
    if (input.abandonedColor !== undefined) {
      abandonedPatch.color = input.abandonedColor.trim() || ABANDONED_STAGE_COLOR;
    }
    if (Object.keys(abandonedPatch).length) {
      await prisma.crmStage.update({ where: { id: abandoned.id }, data: abandonedPatch });
    }
  }

  if (lost) {
    const lostPatch: { name?: string; color?: string } = {};
    if (typeof input.lostName === "string" && input.lostName.trim()) {
      lostPatch.name = input.lostName.trim().slice(0, 80);
    }
    if (input.lostColor !== undefined) {
      lostPatch.color = input.lostColor.trim() || LOST_STAGE_COLOR;
    }
    if (Object.keys(lostPatch).length) {
      await prisma.crmStage.update({ where: { id: lost.id }, data: lostPatch });
    }
  }

  const resolvedIds: string[] = [];
  for (const s of middleInput) {
    if (s.id && existingMiddle.some((e) => e.id === s.id)) {
      await prisma.crmStage.update({
        where: { id: s.id },
        data: { name: s.name, color: s.color },
      });
      resolvedIds.push(s.id);
    } else {
      const created = await createStageRow({
        pipelineId: pipeline.id,
        name: s.name,
        order: 999,
        color: s.color,
        role: null,
      });
      resolvedIds.push(created.id);
    }
  }

  const offset = abandoned ? 2 : 1;
  await prisma.crmStage.update({ where: { id: entry.id }, data: { order: 0 } });
  if (abandoned) {
    await prisma.crmStage.update({ where: { id: abandoned.id }, data: { order: 1 } });
  }
  for (let i = 0; i < resolvedIds.length; i++) {
    await prisma.crmStage.update({
      where: { id: resolvedIds[i] },
      data: { order: i + offset },
    });
  }
  await prisma.crmStage.update({
    where: { id: won.id },
    data: { order: resolvedIds.length + offset },
  });
  if (lost) {
    await prisma.crmStage.update({
      where: { id: lost.id },
      data: { order: resolvedIds.length + offset + 1 },
    });
  }

  return ensureDefaultPipeline(input.workspaceId);
}

export async function deletePipelineStage(input: {
  workspaceId: string;
  stageId: string;
}) {
  const pipeline = await ensureDefaultPipeline(input.workspaceId);
  const stage = pipeline.stages.find((s) => s.id === input.stageId);
  if (!stage) throw new Error("Etapa não encontrada");
  if (isFixedRole(stage.role)) {
    throw new Error("Não é possível remover Novo, Carrinho abandonado, Ganho ou Perdido");
  }
  const entry = pipeline.stages.find((s) => s.role === STAGE_ROLE_ENTRY);
  if (entry) {
    await prisma.nativeLead.updateMany({
      where: { clienteId: input.workspaceId, stageId: stage.id },
      data: { stageId: entry.id, status: "OPEN" },
    });
  }
  await prisma.crmStage.delete({ where: { id: stage.id } });
}

/** Etapa de entrada (Novo) — onde o lead entra no funil. */
export async function getEntryStageId(workspaceId: string): Promise<string | null> {
  const pipeline = await ensureDefaultPipeline(workspaceId);
  return pipeline.stages.find((s) => s.role === STAGE_ROLE_ENTRY)?.id ?? pipeline.stages[0]?.id ?? null;
}
