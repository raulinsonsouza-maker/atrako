/**
 * Após sync Olist: fecha carrinhos OPEN / leads abertos cujo contato
 * já tem pedido Olist pago (casado ou por identidade).
 */

import { prisma } from "@/lib/db";
import { trackOrderPayment } from "@/lib/crm/abandoned-cart";
import { isOlistPaid } from "./ingest-order";

function payloadOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export async function sweepOlistOrphans(workspaceId: string) {
  const paidOlist = await prisma.marketplaceOrder.findMany({
    where: { clienteId: workspaceId, provider: "OLIST_ERP" },
    orderBy: { occurredAt: "desc" },
    take: 500,
    select: {
      id: true,
      externalId: true,
      status: true,
      totalCents: true,
      currency: true,
      occurredAt: true,
      contactId: true,
      leadId: true,
      buyerName: true,
      buyerEmail: true,
      buyerPhone: true,
      rawPayload: true,
    },
  });

  const candidates = paidOlist.filter((o) => isOlistPaid(o.status ?? ""));
  let cartsFixed = 0;
  let leadsTouched = 0;

  for (const order of candidates) {
    const payload = payloadOf(order.rawPayload);
    let contactId = order.contactId;
    if (!contactId && (order.buyerEmail || order.buyerPhone)) {
      const email = order.buyerEmail?.trim().toLowerCase() || null;
      const phoneTail = (order.buyerPhone ?? "").replace(/\D/g, "").slice(-8);
      const contact = await prisma.nativeContact.findFirst({
        where: {
          clienteId: workspaceId,
          OR: [
            ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
            ...(phoneTail.length >= 8
              ? [{ phone: { contains: phoneTail } }, { phoneE164: { contains: phoneTail } }]
              : []),
          ],
        },
        select: { id: true },
      });
      contactId = contact?.id ?? null;
    }
    if (!contactId) continue;

    const openCarts = await prisma.abandonedCart.count({
      where: { clienteId: workspaceId, contactId, status: { in: ["OPEN", "PENDING"] } },
    });
    const openLeads = await prisma.nativeLead.count({
      where: { clienteId: workspaceId, contactId, status: "OPEN" },
    });
    if (!openCarts && !openLeads) continue;

    try {
      await trackOrderPayment({
        workspaceId,
        provider: "OLIST_ERP",
        externalOrderId: order.externalId,
        paid: true,
        occurredAt: order.occurredAt ?? new Date(),
        totalCents: order.totalCents ?? 0,
        currency: order.currency ?? "BRL",
        contactId,
        leadId: order.leadId,
        name: order.buyerName,
        email: order.buyerEmail,
        phone: order.buyerPhone,
      });
      if (openCarts) cartsFixed += 1;
      if (openLeads) leadsTouched += 1;
    } catch (err) {
      console.error(
        "[olist-orphan]",
        order.externalId,
        err instanceof Error ? err.message : err,
      );
    }

    // Garante link no payload se veio de Woo via numero
    if (!payload.matchedProvider && payload.wooExternalId) {
      await prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: {
          contactId,
          rawPayload: { ...payload, matchedProvider: "WOOCOMMERCE" } as object,
        },
      }).catch(() => null);
    }
  }

  return { scanned: candidates.length, cartsFixed, leadsTouched };
}
