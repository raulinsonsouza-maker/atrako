/**
 * Recompra e recuperação de carrinho por período (dashboard do cliente).
 * Recompra = o mesmo contato já tinha pedido pago antes; conta a partir do histórico importado.
 */

import { prisma } from "@/lib/db";
import { isRevenueOrder } from "@/lib/commerce-attribution/order-status";
import { orderOriginKey } from "@/lib/commerce-attribution/store-source";

export type DateRange = { gte: Date; lte: Date };
type Money = { count: number; cents: number };

const DAY = 86_400_000;
const CHUNK = 5000;

function chunks<T>(list: T[]) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

/** Datas dos pedidos pagos de cada contato antes de `before`, em ordem crescente. */
async function paidHistory(clienteId: string, contactIds: string[], before: Date) {
  const byContact = new Map<string, Date[]>();
  for (const ids of chunks(contactIds)) {
    const rows = await prisma.marketplaceOrder.findMany({
      where: { clienteId, contactId: { in: ids }, occurredAt: { lte: before } },
      select: { contactId: true, status: true, occurredAt: true },
    });
    for (const r of rows) {
      if (!r.contactId || !r.occurredAt || !isRevenueOrder(r.status)) continue;
      const list = byContact.get(r.contactId) ?? [];
      list.push(r.occurredAt);
      byContact.set(r.contactId, list);
    }
  }
  for (const list of byContact.values()) list.sort((a, b) => a.getTime() - b.getTime());
  return byContact;
}

function lastBefore(dates: Date[] | undefined, at: Date) {
  if (!dates) return null;
  let found: Date | null = null;
  for (const d of dates) {
    if (d.getTime() >= at.getTime()) break;
    found = d;
  }
  return found;
}

/** `origem`: só pedidos dessa origem (`orderOriginKey`); o histórico de recompra segue com todos. */
export async function getRepurchaseMetrics(clienteId: string, range: DateRange, origem?: string | null) {
  const orders = await prisma.marketplaceOrder.findMany({
    where: { clienteId, occurredAt: range },
    select: {
      contactId: true,
      status: true,
      totalCents: true,
      occurredAt: true,
      provider: true,
      source: { select: { channel: true } },
    },
    orderBy: { occurredAt: "asc" },
  });
  const paid = orders.filter(
    (o) =>
      isRevenueOrder(o.status) &&
      o.occurredAt &&
      (!origem || orderOriginKey(o.provider, o.source?.channel) === origem),
  );
  const paidCents = paid.reduce((s, o) => s + (o.totalCents ?? 0), 0);

  const unidentified: Money = { count: 0, cents: 0 };
  const first: Money = { count: 0, cents: 0 };
  const repeat: Money = { count: 0, cents: 0 };
  const newBuyers = new Set<string>();
  const returningBuyers = new Set<string>();
  let gapDaysSum = 0;
  let gapCount = 0;

  const contactIds = [...new Set(paid.map((o) => o.contactId).filter(Boolean) as string[])];
  const history = contactIds.length ? await paidHistory(clienteId, contactIds, range.lte) : new Map<string, Date[]>();
  const seen = new Set<string>();

  for (const o of paid) {
    const cents = o.totalCents ?? 0;
    if (!o.contactId) {
      unidentified.count++;
      unidentified.cents += cents;
      continue;
    }
    const prev = lastBefore(history.get(o.contactId), o.occurredAt!);
    if (prev) {
      repeat.count++;
      repeat.cents += cents;
      gapDaysSum += (o.occurredAt!.getTime() - prev.getTime()) / DAY;
      gapCount++;
    } else {
      first.count++;
      first.cents += cents;
    }
    if (!seen.has(o.contactId)) {
      seen.add(o.contactId);
      (prev ? returningBuyers : newBuyers).add(o.contactId);
    }
  }

  const buyers = newBuyers.size + returningBuyers.size;
  return {
    paid: { count: paid.length, cents: paidCents },
    firstOrders: first,
    repeatOrders: repeat,
    repeatShare: paidCents > 0 ? repeat.cents / paidCents : null,
    buyers,
    newBuyers: newBuyers.size,
    returningBuyers: returningBuyers.size,
    returningShare: buyers > 0 ? returningBuyers.size / buyers : null,
    avgGapDays: gapCount ? Math.round(gapDaysSum / gapCount) : null,
    unidentified,
  };
}

export const RECOVERY_AGE_BUCKETS = [
  { key: "d30", label: "até 30 dias", maxDays: 30 },
  { key: "d60", label: "30 a 60 dias", maxDays: 60 },
  { key: "d90", label: "60 a 90 dias", maxDays: 90 },
  { key: "d180", label: "90 dias a 6 meses", maxDays: Infinity },
] as const;

/** Origem do pedido que pagou cada carrinho recuperado. */
async function recoveredOrigins(
  clienteId: string,
  carts: Array<{ id: string; provider: string; recoveredOrderId: string | null }>,
) {
  const externalIds = [...new Set(carts.map((c) => c.recoveredOrderId).filter(Boolean) as string[])];
  const orders = externalIds.length
    ? await prisma.marketplaceOrder.findMany({
        where: { clienteId, externalId: { in: externalIds } },
        select: { provider: true, externalId: true, source: { select: { channel: true } } },
      })
    : [];
  const channelOf = new Map(orders.map((o) => [`${o.provider}:${o.externalId}`, o.source?.channel ?? null]));
  return new Map(
    carts.map((c) => [c.id, orderOriginKey(c.provider, channelOf.get(`${c.provider}:${c.recoveredOrderId}`))]),
  );
}

/** `origem`: só carrinhos pagos por pedido dessa origem; a coorte de abandono não tem origem e sai do resultado. */
export async function getCartRecoveryMetrics(clienteId: string, range: DateRange, origem?: string | null) {
  const [cohort, allRecovered] = await Promise.all([
    prisma.abandonedCart.groupBy({
      by: ["status"],
      where: { clienteId, status: { in: ["OPEN", "RECOVERED", "EXPIRED"] }, abandonedAt: range },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.abandonedCart.findMany({
      where: { clienteId, status: "RECOVERED", recoveredAt: range },
      select: {
        id: true,
        provider: true,
        recoveredOrderId: true,
        contactId: true,
        totalCents: true,
        recoveredCents: true,
        abandonedAt: true,
        recoveredAt: true,
        notifiedAt: true,
      },
    }),
  ]);

  const abandoned: Money = {
    count: cohort.reduce((s, r) => s + r._count._all, 0),
    cents: cohort.reduce((s, r) => s + (r._sum.totalCents ?? 0), 0),
  };
  const cohortRecovered = cohort.find((r) => r.status === "RECOVERED")?._count._all ?? 0;
  if (!abandoned.count && !allRecovered.length) return null;

  let recovered = allRecovered;
  if (origem) {
    const originOf = await recoveredOrigins(clienteId, allRecovered);
    recovered = allRecovered.filter((c) => originOf.get(c.id) === origem);
  }

  const cartIds = recovered.map((c) => c.id);
  const enrollments = cartIds.length
    ? await prisma.messageFlowEnrollment.findMany({
        where: { clienteId, refType: "cart", refId: { in: cartIds } },
        select: { id: true, refId: true, holdout: true },
      })
    : [];
  const enrolledCarts = new Set(enrollments.map((e) => e.refId));
  const deliveries = enrollments.length
    ? await prisma.messageDelivery.findMany({
        where: {
          enrollmentId: { in: enrollments.filter((e) => !e.holdout).map((e) => e.id) },
          isTest: false,
          sentAt: { not: null },
        },
        select: { enrollmentId: true, sentAt: true },
      })
    : [];
  const cartOfEnrollment = new Map(enrollments.map((e) => [e.id, e.refId]));
  const firstSent = new Map<string, Date>();
  for (const d of deliveries) {
    const cartId = cartOfEnrollment.get(d.enrollmentId ?? "");
    if (!cartId || !d.sentAt) continue;
    const cur = firstSent.get(cartId);
    if (!cur || d.sentAt < cur) firstSent.set(cartId, d.sentAt);
  }

  const contactIds = [...new Set(recovered.map((c) => c.contactId).filter(Boolean) as string[])];
  const latestAbandon = recovered.reduce((m, c) => Math.max(m, c.abandonedAt.getTime()), 0);
  const history = contactIds.length
    ? await paidHistory(clienteId, contactIds, new Date(latestAbandon))
    : new Map<string, Date[]>();

  const total: Money = { count: 0, cents: 0 };
  const byMessage: Money = { count: 0, cents: 0 };
  const alone: Money = { count: 0, cents: 0 };
  const fromCustomers: Money = { count: 0, cents: 0 };
  const fromNew: Money = { count: 0, cents: 0 };
  const byAge = RECOVERY_AGE_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: 0, cents: 0 }));

  for (const c of recovered) {
    const cents = c.recoveredCents ?? c.totalCents;
    const at = c.recoveredAt!;
    total.count++;
    total.cents += cents;

    const sent = firstSent.get(c.id);
    const legacy = !enrolledCarts.has(c.id) && c.notifiedAt && c.notifiedAt < at;
    const side = (sent && sent < at) || legacy ? byMessage : alone;
    side.count++;
    side.cents += cents;

    const customer = c.contactId ? lastBefore(history.get(c.contactId), c.abandonedAt) : null;
    const who = customer ? fromCustomers : fromNew;
    who.count++;
    who.cents += cents;

    const days = (at.getTime() - c.abandonedAt.getTime()) / DAY;
    const bucket = byAge[RECOVERY_AGE_BUCKETS.findIndex((b) => days <= b.maxDays)];
    bucket.count++;
    bucket.cents += cents;
  }

  return {
    /** null quando filtrado por origem: carrinho abandonado não tem origem. */
    abandoned: origem ? null : abandoned,
    recovered: total,
    cohortRecovered,
    cohortRate: !origem && abandoned.count ? cohortRecovered / abandoned.count : null,
    byMessage,
    alone,
    fromCustomers,
    fromNew,
    byAge,
  };
}

export type RepurchaseMetrics = Awaited<ReturnType<typeof getRepurchaseMetrics>>;
export type CartRecoveryMetrics = NonNullable<Awaited<ReturnType<typeof getCartRecoveryMetrics>>>;
