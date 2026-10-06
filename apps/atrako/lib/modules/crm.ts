/**
 * CRM nativo — leads do workspace (NativeLead + Person hub).
 */

import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { withStageHistory } from "@/lib/crm/stage-history";
import { contactLocation, formatLocation } from "@/lib/commerce/order-details";
import { isEcommerceCliente } from "@/lib/clientProfiles";
import { brtDayBounds, getLeadAcquisition } from "@/lib/crm/lead-channel";
import { originLabel } from "@/lib/commerce-attribution/store-source";

export const STAGE_ROLE_ENTRY = "ENTRY";
export const STAGE_ROLE_WON = "WON";
/** Criada sob demanda no primeiro carrinho abandonado; depois fica fixa logo após Novo. */
export const STAGE_ROLE_ABANDONED = "ABANDONED";
/** Criada sob demanda (pedido expirado / reembolso); fica fixa depois de Ganho. */
export const STAGE_ROLE_LOST = "LOST";
/** Carrinho aberto sem compra há +30 / +60 / +90 dias; criadas sob demanda, logo após Carrinho abandonado. */
export const STAGE_ROLE_ABANDONED_30 = "ABANDONED_30";
export const STAGE_ROLE_ABANDONED_60 = "ABANDONED_60";
export const STAGE_ROLE_ABANDONED_90 = "ABANDONED_90";
/** Janela de 7 dias (descontinuada): `retireLegacyAgingStages` devolve os leads para Carrinho abandonado. */
const LEGACY_AGING_ROLES = ["ABANDONED_7"];

export type AgingRole = typeof STAGE_ROLE_ABANDONED_30 | typeof STAGE_ROLE_ABANDONED_60 | typeof STAGE_ROLE_ABANDONED_90;
export type StageRole = "ENTRY" | "WON" | "ABANDONED" | AgingRole | "LOST";

/** Da mais nova para a mais antiga; `minDays` = idade do abandono para entrar. */
export const AGING_STAGES: ReadonlyArray<{ role: AgingRole; minDays: number; name: string; color: string }> = [
  { role: STAGE_ROLE_ABANDONED_30, minDays: 30, name: "Abandonado há +30 dias", color: "#FF9F0A" },
  { role: STAGE_ROLE_ABANDONED_60, minDays: 60, name: "Abandonado há +60 dias", color: "#FF6B00" },
  { role: STAGE_ROLE_ABANDONED_90, minDays: 90, name: "Abandonado há +90 dias", color: "#C2410C" },
];

const ABANDON_FAMILY = new Set<string>([STAGE_ROLE_ABANDONED, ...AGING_STAGES.map((s) => s.role), ...LEGACY_AGING_ROLES]);

/** Carrinho abandonado ou uma das janelas +30/+60/+90. */
export function isAbandonFamilyRole(role: string | null | undefined) {
  return ABANDON_FAMILY.has(role ?? "");
}

function isFixedRole(role: string | null | undefined) {
  return (
    role === STAGE_ROLE_ENTRY ||
    role === STAGE_ROLE_WON ||
    role === STAGE_ROLE_LOST ||
    isAbandonFamilyRole(role)
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

/** `leads` semeia as colunas de inside sales; `ecommerce` só garante as colunas fixas. */
export type PipelinePreset = "leads" | "ecommerce";

async function loadDefaultPipeline(clienteId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; clienteId: string; preset: string | null }>>`
    SELECT id, "clienteId", preset FROM "CrmPipeline"
    WHERE "clienteId" = ${clienteId} AND "isDefault" = true
    ORDER BY "createdAt" ASC LIMIT 1
  `;
  const pipeline = rows[0];
  if (!pipeline) return null;
  const stages = await loadStages(pipeline.id);
  return {
    id: pipeline.id,
    clienteId: pipeline.clienteId,
    preset: (pipeline.preset === "ecommerce" ? "ecommerce" : "leads") as PipelinePreset,
    stages,
  };
}

export async function setPipelinePreset(pipelineId: string, preset: PipelinePreset) {
  await prisma.$executeRaw`UPDATE "CrmPipeline" SET preset = ${preset} WHERE id = ${pipelineId}`;
}

/** Garante pipeline + colunas base; Novo (ENTRY) e Ganho (WON) sempre fixos. */
export async function ensureDefaultPipeline(clienteId: string) {
  let pipeline = await loadDefaultPipeline(clienteId);

  if (!pipeline) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { nome: true, slug: true, perfilPanel: true, objetivoMidia: true },
    });
    const ecommerce = isEcommerceCliente(cliente);
    const created = await prisma.crmPipeline.create({
      data: {
        clienteId,
        name: "Principal",
        isDefault: true,
        stages: {
          create: ATRAKO_BASE_STAGES.filter((s) => !ecommerce || s.role).map((s) => ({
            name: s.name,
            order: s.order,
            color: s.color,
          })),
        },
      },
    });
    if (ecommerce) await setPipelinePreset(created.id, "ecommerce");
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

  if (pipeline.preset === "ecommerce") return normalizeStageOrder(pipeline.clienteId);

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
  if (role && LEGACY_AGING_ROLES.includes(role)) return 1;
  if (role === STAGE_ROLE_ABANDONED_30) return 2;
  if (role === STAGE_ROLE_ABANDONED_60) return 3;
  if (role === STAGE_ROLE_ABANDONED_90) return 4;
  if (role === STAGE_ROLE_WON) return 6;
  if (role === STAGE_ROLE_LOST) return 7;
  return 5;
}

/** Novo, Carrinho abandonado, +30, +60, +90 (se existirem), livres, Ganho, Perdido (se existir). */
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

/**
 * Colunas de janela descontinuadas (+7 dias): os leads voltam para Carrinho abandonado e a coluna sai.
 * O próximo `ageOpenCarts` recoloca cada um na janela certa.
 */
export async function retireLegacyAgingStages(clienteId?: string) {
  const stages = await prisma.crmStage.findMany({
    where: { role: { in: LEGACY_AGING_ROLES }, ...(clienteId ? { pipeline: { clienteId } } : {}) },
    select: { id: true, pipeline: { select: { clienteId: true } } },
  });
  let moved = 0;
  for (const legacy of stages) {
    const target = await ensureAbandonedStage(legacy.pipeline.clienteId);
    const leads = await prisma.nativeLead.findMany({ where: { stageId: legacy.id }, select: { id: true, metadata: true } });
    for (const lead of leads) {
      await prisma.nativeLead.update({
        where: { id: lead.id },
        data: {
          stageId: target.id,
          metadata: withStageHistory((lead.metadata ?? {}) as Record<string, unknown>, {
            stageId: target.id,
            stage: target.name,
            role: STAGE_ROLE_ABANDONED,
            at: new Date(),
            by: "auto",
            reason: "colunas de carrinho reorganizadas",
          }) as never,
        },
      });
      moved++;
    }
    await prisma.crmStage.delete({ where: { id: legacy.id } });
    await normalizeStageOrder(legacy.pipeline.clienteId);
  }
  return { stages: stages.length, moved };
}

/** Garante a coluna da janela (+30/+60/+90) sob demanda. */
export async function ensureAgingStage(clienteId: string, role: AgingRole) {
  const def = AGING_STAGES.find((s) => s.role === role);
  if (!def) throw new Error(`Janela inválida: ${role}`);
  const pipeline = await ensureDefaultPipeline(clienteId);
  const existing = pipeline.stages.find((s) => s.role === role);
  if (existing) return existing;
  await createStageRow({
    pipelineId: pipeline.id,
    name: def.name,
    order: 2,
    color: def.color,
    role,
  });
  const final = await normalizeStageOrder(clienteId);
  return final.stages.find((s) => s.role === role)!;
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

export async function getPipelineBoard(
  clienteId: string,
  opts?: {
    q?: string;
    /** Lojas (`NativeLead.source`), separadas por vírgula. */
    source?: string;
    openCart?: boolean;
    /** Canais de aquisição (`getLeadAcquisition`), separados por vírgula. Somam com `source` (OU). */
    channel?: string;
    /** Entrada no funil, dias de Brasília `YYYY-MM-DD`. */
    from?: string;
    to?: string;
  },
) {
  const pipeline = await ensureDefaultPipeline(clienteId);
  const q = opts?.q?.trim().toLowerCase();
  const csv = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const storeSources = csv(opts?.source);
  const channelSet = new Set(csv(opts?.channel));
  const range = brtDayBounds(opts?.from, opts?.to);

  const [openCartLeadIds, acquisition] = await Promise.all([
    opts?.openCart
      ? prisma.abandonedCart
          .findMany({
            where: { clienteId, status: "OPEN", leadId: { not: null } },
            select: { leadId: true },
            distinct: ["leadId"],
          })
          .then((rows) => rows.map((c) => c.leadId as string))
      : Promise.resolve(null),
    getLeadAcquisition(clienteId),
  ]);

  const inRange = (d: Date) =>
    (!range.gte || d >= range.gte) && (!range.lte || d <= range.lte);
  const channelCounts = new Map<string, number>();
  const ranged = Boolean(range.gte || range.lte);
  const rangeIds: string[] = [];
  const channelIds: string[] = [];
  for (const [id, a] of acquisition) {
    if (!inRange(a.enteredAt)) continue;
    if (ranged) rangeIds.push(id);
    channelCounts.set(a.channel, (channelCounts.get(a.channel) ?? 0) + 1);
    if (channelSet.has(a.channel)) channelIds.push(id);
  }
  const channels = [...channelCounts.entries()]
    .map(([value, count]) => ({ value, label: originLabel(value), count }))
    .sort((a, b) => (a.value === "unknown" ? 1 : b.value === "unknown" ? -1 : b.count - a.count));

  let idFilter: string[] | null = ranged ? rangeIds : null;
  if (openCartLeadIds) {
    const cartSet = new Set(openCartLeadIds);
    idFilter = idFilter ? idFilter.filter((id) => cartSet.has(id)) : openCartLeadIds;
  }

  const originOr: Prisma.NativeLeadWhereInput[] = [
    ...(channelSet.size ? [{ id: { in: channelIds } }] : []),
    ...(storeSources.length ? [{ source: { in: storeSources } }] : []),
  ];
  const where: Prisma.NativeLeadWhereInput = {
    clienteId,
    ...(idFilter ? { id: { in: idFilter } } : {}),
    AND: [
      ...(originOr.length ? [{ OR: originOr }] : []),
      ...(q
        ? [
            {
              OR: [
                { contact: { name: { contains: q, mode: "insensitive" as const } } },
                { contact: { email: { contains: q, mode: "insensitive" as const } } },
                { contact: { phone: { contains: q } } },
              ],
            },
          ]
        : []),
    ],
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
    prisma.nativeLead.groupBy({
      by: ["source"],
      where: { clienteId, ...(ranged ? { id: { in: rangeIds } } : {}) },
      _count: { _all: true },
    }),
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
  const heat = await getLeadHeat(clienteId);
  const toLead = (l: Parameters<typeof mapLead>[0]) => ({
    ...mapLead(l, acquisition.get(l.id)?.channel),
    activityAt: (heat.get(l.id)?.activityAt ?? l.createdAt).toISOString(),
  });
  /** Mais quente primeiro: abandono mais recente nas colunas de carrinho, última atividade nas demais. */
  const leadsFor = async (stageId: string | null, role?: string | null) => {
    const abandon = isAbandonFamilyRole(role);
    const key = (id: string) => {
      const h = heat.get(id);
      return ((abandon ? h?.openCartAt : null) ?? h?.activityAt)?.getTime() ?? 0;
    };
    const ids = (await prisma.nativeLead.findMany({ where: { ...where, stageId }, select: { id: true } }))
      .map((r) => r.id)
      .sort((a, b) => key(b) - key(a))
      .slice(0, PIPELINE_LEADS_PER_STAGE);
    const pos = new Map(ids.map((id, i) => [id, i]));
    const rows = await prisma.nativeLead.findMany({ where: { id: { in: ids } }, include: { contact: true } });
    return rows.sort((a, b) => pos.get(a.id)! - pos.get(b.id)!).map(toLead);
  };

  const stages = await Promise.all(
    pipeline.stages.map(async (stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color || STAGE_COLOR_DEFAULT,
      order: stage.order,
      role: (stage.role as StageRole | null) ?? null,
      ...statsFor(stage.id),
      leads: await leadsFor(stage.id, stage.role),
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
      leads: await leadsFor(null),
    });
  }

  const loadedIds = stages.flatMap((s) => s.leads.map((l) => l.id));
  if (loadedIds.length) {
    const carts = await prisma.abandonedCart.groupBy({
      by: ["leadId"],
      where: { clienteId, status: "OPEN", leadId: { in: loadedIds } },
      _sum: { totalCents: true },
      _max: { abandonedAt: true },
    });
    const byLead = new Map(carts.map((c) => [c.leadId, c]));
    for (const s of stages) {
      for (const l of s.leads) {
        const cart = byLead.get(l.id);
        l.openCartCents = cart ? cart._sum.totalCents ?? 0 : null;
        l.openCartAt = cart?._max.abandonedAt?.toISOString() ?? null;
      }
    }
  }

  const wonStageIds = new Set(pipeline.stages.filter((s) => isWonStage(s)).map((s) => s.id));
  const statusCount = (status: string) =>
    byStatus.find((r) => r.status === status)?._count._all ?? 0;

  return {
    pipelineId: pipeline.id,
    stages,
    sources,
    channels,
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

/**
 * Última atividade do lead (pedido ou carrinho; entrada só sem nenhum dos dois — `createdAt` de lead importado é a data da importação)
 * e abandono mais recente ainda aberto.
 */
async function getLeadHeat(clienteId: string) {
  const rows = await prisma.$queryRaw<{ id: string; activityAt: Date; openCartAt: Date | null }[]>`
    with carts as (
      select "leadId", max("abandonedAt") as last_at,
        max("abandonedAt") filter (where status = 'OPEN') as open_at
      from "AbandonedCart"
      where "clienteId" = ${clienteId} and "leadId" is not null
      group by 1
    ),
    orders as (
      select "contactId", max("occurredAt") as last_at
      from "MarketplaceOrder"
      where "clienteId" = ${clienteId} and "contactId" is not null
      group by 1
    )
    select l.id, coalesce(greatest(c.last_at, o.last_at), l."createdAt") as "activityAt", c.open_at as "openCartAt"
    from "NativeLead" l
    left join carts c on c."leadId" = l.id
    left join orders o on o."contactId" = l."contactId"
    where l."clienteId" = ${clienteId}
  `;
  return new Map(rows.map((r) => [r.id, r]));
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
  contact: { name: string; email: string | null; phone: string | null; metadata?: unknown } | null;
}, channel?: string) {
  return {
    id: l.id,
    contactId: l.contactId,
    name: l.contact?.name ?? "Sem nome",
    email: l.contact?.email ?? null,
    phone: l.contact?.phone ?? null,
    location: formatLocation(contactLocation(l.contact?.metadata)),
    source: l.source,
    channel: channel && channel !== "unknown" ? channel : null,
    channelLabel: channel && channel !== "unknown" ? originLabel(channel) : null,
    status: l.status,
    dealValue: l.dealValue != null ? Number(l.dealValue) : null,
    stageId: l.stageId,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    openCartCents: null as number | null,
    openCartAt: null as string | null,
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
    throw new Error("Não é possível remover Novo, as colunas de carrinho, Ganho ou Perdido");
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

/**
 * Troca o preset do funil. `ecommerce`: leads das colunas de inside sales padrão vão para Novo
 * e essas colunas somem (colunas criadas à mão ficam). `dryRun` só conta.
 */
export async function applyPipelinePreset(
  clienteId: string,
  preset: PipelinePreset,
  opts?: { dryRun?: boolean },
) {
  const pipeline = await ensureDefaultPipeline(clienteId);
  const entry = pipeline.stages.find((s) => s.role === STAGE_ROLE_ENTRY);
  if (!entry) throw new Error("Funil sem etapa de entrada");
  const baseNames = new Set(ATRAKO_BASE_STAGES.filter((s) => !s.role).map((s) => s.name.toLowerCase()));
  const targets =
    preset === "ecommerce"
      ? pipeline.stages.filter((s) => !isFixedRole(s.role) && baseNames.has(s.name.trim().toLowerCase()))
      : [];

  const leads = targets.length
    ? await prisma.nativeLead.findMany({
        where: { clienteId, stageId: { in: targets.map((s) => s.id) } },
        select: { id: true, stageId: true, metadata: true },
      })
    : [];
  const byStage = targets.map((s) => ({
    stage: s.name,
    leads: leads.filter((l) => l.stageId === s.id).length,
  }));
  if (opts?.dryRun) return { preset, dryRun: true, moved: leads.length, stages: byStage };

  const now = new Date();
  for (const lead of leads) {
    const meta =
      lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
        ? (lead.metadata as Record<string, unknown>)
        : {};
    await prisma.nativeLead.update({
      where: { id: lead.id },
      data: {
        stageId: entry.id,
        status: "OPEN",
        metadata: withStageHistory(meta, {
          stageId: entry.id,
          stage: entry.name,
          role: STAGE_ROLE_ENTRY,
          at: now,
          by: "auto",
          reason: "reorganização do funil",
        }) as never,
      },
    });
  }
  for (const s of targets) await prisma.crmStage.delete({ where: { id: s.id } });
  await setPipelinePreset(pipeline.id, preset);
  if (preset === "leads") await ensureDefaultPipeline(clienteId);
  else await normalizeStageOrder(clienteId);
  return { preset, dryRun: false, moved: leads.length, stages: byStage };
}

/** Etapa de entrada (Novo) — onde o lead entra no funil. */
export async function getEntryStageId(workspaceId: string): Promise<string | null> {
  const pipeline = await ensureDefaultPipeline(workspaceId);
  return pipeline.stages.find((s) => s.role === STAGE_ROLE_ENTRY)?.id ?? pipeline.stages[0]?.id ?? null;
}
