/**
 * CustomerProfile: métricas por contato + etapa do ciclo (LEAD → NOVO → RECORRENTE/VIP → EM_RISCO → INATIVO).
 * Recalculado no pedido pago e no cron noturno, que também matricula recompra e win-back.
 */

import { prisma } from "@/lib/db";
import { isPaidMarketplaceOrder } from "@/lib/flows/orders-util";
import { enrollContact } from "@/lib/flows/engine";
import { lastPurchasedItems } from "@/lib/flows/recommendations";

const DAY = 86_400_000;
const DEFAULT_INTERVAL_DAYS = 60;

export type Lifecycle = "LEAD" | "NOVO" | "RECORRENTE" | "VIP" | "EM_RISCO" | "INATIVO" | "PERDIDO";

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  LEAD: "Lead",
  NOVO: "Cliente novo",
  RECORRENTE: "Recorrente",
  VIP: "VIP",
  EM_RISCO: "Em risco",
  INATIVO: "Inativo",
  PERDIDO: "Perdido",
};

type PaidOrder = { at: Date; cents: number; titles: string[] };

async function paidOrdersFor(workspaceId: string, contactId: string): Promise<PaidOrder[]> {
  const [mkt, com, food] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: { clienteId: workspaceId, contactId },
      select: {
        provider: true,
        status: true,
        rawPayload: true,
        totalCents: true,
        occurredAt: true,
        createdAt: true,
        items: { select: { title: true } },
      },
    }),
    prisma.commerceOrder.findMany({
      where: { clienteId: workspaceId, contactId, approvedAt: { not: null } },
      select: { approvedAt: true, totalCents: true, items: { select: { name: true } } },
    }),
    prisma.foodOrder.findMany({
      where: { clienteId: workspaceId, contactId, paymentStatus: "APPROVED", paidAt: { not: null } },
      select: { paidAt: true, totalCents: true, items: { select: { name: true } } },
    }),
  ]);
  const out: PaidOrder[] = [];
  for (const o of mkt) {
    if (!isPaidMarketplaceOrder(o)) continue;
    out.push({ at: o.occurredAt ?? o.createdAt, cents: o.totalCents ?? 0, titles: o.items.map((i) => i.title) });
  }
  for (const o of com) {
    out.push({ at: o.approvedAt!, cents: o.totalCents, titles: o.items.map((i) => i.name) });
  }
  for (const o of food) {
    out.push({ at: o.paidAt!, cents: o.totalCents, titles: o.items.map((i) => i.name) });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function computeLifecycle(input: {
  ordersCount: number;
  lastOrderAt: Date | null;
  intervalDays: number;
  leadLost: boolean;
  now?: Date;
}): Lifecycle {
  const now = input.now ?? new Date();
  if (!input.ordersCount || !input.lastOrderAt) return input.leadLost ? "PERDIDO" : "LEAD";
  const since = (now.getTime() - input.lastOrderAt.getTime()) / DAY;
  if (since > Math.max(3 * input.intervalDays, 180)) return "INATIVO";
  if (since > Math.max(1.5 * input.intervalDays, 90)) return "EM_RISCO";
  if (input.ordersCount >= 5) return "VIP";
  return input.ordersCount >= 2 ? "RECORRENTE" : "NOVO";
}

const typicalIntervalCache = new Map<string, { at: number; days: number }>();

/** Intervalo típico de recompra da loja (mediana dos clientes com 2+ pedidos). */
export async function storeTypicalIntervalDays(workspaceId: string) {
  const cached = typicalIntervalCache.get(workspaceId);
  if (cached && Date.now() - cached.at < 6 * 3_600_000) return cached.days;
  const rows = await prisma.customerProfile.findMany({
    where: { clienteId: workspaceId, ordersCount: { gte: 2 }, avgIntervalDays: { not: null } },
    select: { avgIntervalDays: true },
    take: 5000,
  });
  const vals = rows.map((r) => r.avgIntervalDays!).sort((a, b) => a - b);
  const days = vals.length >= 5 ? Math.max(7, Math.round(vals[Math.floor(vals.length / 2)])) : DEFAULT_INTERVAL_DAYS;
  typicalIntervalCache.set(workspaceId, { at: Date.now(), days });
  return days;
}

export async function recomputeProfile(workspaceId: string, contactId: string) {
  const orders = await paidOrdersFor(workspaceId, contactId);
  const prev = await prisma.customerProfile.findUnique({ where: { contactId } });
  const lostLead = await prisma.nativeLead.findFirst({
    where: { clienteId: workspaceId, contactId, status: "LOST" },
    select: { id: true },
  });
  const ordersCount = orders.length;
  const totalSpentCents = orders.reduce((s, o) => s + o.cents, 0);
  const firstOrderAt = orders[0]?.at ?? null;
  const lastOrderAt = orders[orders.length - 1]?.at ?? null;
  let avgIntervalDays: number | null = null;
  if (orders.length >= 2) {
    const diffs = orders.slice(1).map((o, i) => (o.at.getTime() - orders[i].at.getTime()) / DAY);
    avgIntervalDays = Math.round((diffs.reduce((s, d) => s + d, 0) / diffs.length) * 10) / 10;
  }
  const typical = await storeTypicalIntervalDays(workspaceId);
  const interval = avgIntervalDays && avgIntervalDays >= 3 ? avgIntervalDays : typical;
  const nextPurchaseAt = lastOrderAt ? new Date(lastOrderAt.getTime() + interval * DAY) : null;
  const counts = new Map<string, number>();
  for (const o of orders) for (const t of o.titles) counts.set(t, (counts.get(t) ?? 0) + 1);
  const topProducts = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, count]) => ({ title, count }));
  const lifecycle = computeLifecycle({ ordersCount, lastOrderAt, intervalDays: interval, leadLost: Boolean(lostLead) });

  const profile = await prisma.customerProfile.upsert({
    where: { contactId },
    create: {
      clienteId: workspaceId,
      contactId,
      ordersCount,
      totalSpentCents,
      firstOrderAt,
      lastOrderAt,
      avgIntervalDays,
      nextPurchaseAt,
      topProducts,
      lifecycle,
    },
    update: { ordersCount, totalSpentCents, firstOrderAt, lastOrderAt, avgIntervalDays, nextPurchaseAt, topProducts, lifecycle },
  });
  return { profile, previousLifecycle: (prev?.lifecycle ?? null) as Lifecycle | null };
}

function dayKey(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "none";
}

/** Recompra (data prevista chegou) e win-back (entrou em Em risco / Inativo). */
export async function runLifecycleTriggers(
  workspaceId: string,
  contactId: string,
  profile: { lifecycle: string; lastOrderAt: Date | null; nextPurchaseAt: Date | null; ordersCount: number },
  previous: Lifecycle | null,
  now = new Date(),
) {
  let enrolled = 0;
  if (profile.nextPurchaseAt && profile.ordersCount > 0) {
    const due = profile.nextPurchaseAt.getTime();
    if (due <= now.getTime() && due > now.getTime() - 3 * DAY) {
      const items = await lastPurchasedItems(workspaceId, contactId, 3);
      const r = await enrollContact({
        clienteId: workspaceId,
        trigger: "repurchase_due",
        contactId,
        dedupeKey: `repurchase:${dayKey(profile.lastOrderAt)}`,
        context: { items, includePurchased: true, destination: items[0]?.productUrl ?? null },
      });
      enrolled += r.enrolled;
    }
  }
  // Sem exigir mudança de etapa: quem ficou fora pelo teto diário entra nas noites seguintes (dedupe evita repetição)
  void previous;
  if (profile.lifecycle === "EM_RISCO" || profile.lifecycle === "INATIVO") {
    const r = await enrollContact({
      clienteId: workspaceId,
      trigger: "winback",
      contactId,
      dedupeKey: `winback:${profile.lifecycle}:${dayKey(profile.lastOrderAt)}`,
      context: {},
    });
    enrolled += r.enrolled;
  }
  return enrolled;
}

/** Cron noturno: todos os contatos com pedido (ou perfil) em todos os workspaces. */
export async function recomputeAllProfiles(opts?: { workspaceId?: string; dryRun?: boolean; triggers?: boolean }) {
  const where = opts?.workspaceId ? { clienteId: opts.workspaceId } : {};
  const [mkt, com, foodContacts, existing] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: { ...where, contactId: { not: null } },
      distinct: ["clienteId", "contactId"],
      select: { clienteId: true, contactId: true },
    }),
    prisma.commerceOrder.findMany({
      where: { ...where, contactId: { not: null }, approvedAt: { not: null } },
      distinct: ["clienteId", "contactId"],
      select: { clienteId: true, contactId: true },
    }),
    prisma.foodOrder.findMany({
      where: { ...where, contactId: { not: null }, paymentStatus: "APPROVED" },
      distinct: ["clienteId", "contactId"],
      select: { clienteId: true, contactId: true },
    }),
    prisma.customerProfile.findMany({ where, select: { clienteId: true, contactId: true } }),
  ]);
  const pairs = new Map<string, { clienteId: string; contactId: string }>();
  for (const r of [...mkt, ...com, ...foodContacts, ...existing]) {
    if (r.contactId) pairs.set(r.contactId, { clienteId: r.clienteId, contactId: r.contactId });
  }
  let profiles = 0;
  let enrolled = 0;
  const lifecycles: Record<string, number> = {};
  for (const { clienteId, contactId } of pairs.values()) {
    if (opts?.dryRun) {
      profiles++;
      continue;
    }
    try {
      const { profile, previousLifecycle } = await recomputeProfile(clienteId, contactId);
      profiles++;
      lifecycles[profile.lifecycle] = (lifecycles[profile.lifecycle] ?? 0) + 1;
      if (opts?.triggers !== false) enrolled += await runLifecycleTriggers(clienteId, contactId, profile, previousLifecycle);
    } catch (err) {
      console.warn("[profiles]", contactId, err instanceof Error ? err.message : err);
    }
  }
  return { contacts: pairs.size, profiles, enrolled, lifecycles };
}
