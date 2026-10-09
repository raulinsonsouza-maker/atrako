/**
 * Pedido Food. Pagamento e andamento são campos diferentes.
 * Não chama approveOrder: aquele fluxo libera área de membros.
 */

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { upsertPersonAndLead, toPhoneE164 } from "@/lib/atrako/person";
import { upsertLedgerEntry } from "@/lib/atrako/finance-ledger";
import { createMercadoPagoOrder, getMercadoPagoOrder } from "@/lib/commerce/mp";
import { notify } from "@/lib/notifications";
import { enrollContact } from "@/lib/flows/engine";
import {
  canTransitionFulfillment,
  quoteFoodOrder,
  type FoodFulfillment,
  type FoodPaymentMethod,
  type QuoteLine,
} from "@/lib/food/quote";
import { sendFoodStatusMessage } from "@/lib/food/status-message";

export const FOOD_REF_PREFIX = "food:";

type AddressInput = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
};

export type CreateFoodOrderInput = {
  slug: string;
  clientRequestId: string;
  fulfillment: FoodFulfillment;
  paymentMethod: FoodPaymentMethod;
  customerName: string;
  phone: string;
  couponCode?: string | null;
  changeForCents?: number | null;
  address?: AddressInput | null;
  items: Array<{ itemId: string; quantity: number; removals?: string[]; notes?: string | null }>;
};

function payerEmail(phoneE164: string) {
  const digits = phoneE164.replace(/\D/g, "");
  return `food.${digits}@checkout.atrako.app`;
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function loadLines(
  storeId: string,
  items: CreateFoodOrderInput["items"],
): Promise<{ ok: true; lines: QuoteLine[] } | { ok: false; error: string }> {
  const ids = [...new Set(items.map((i) => i.itemId))];
  const rows = await prisma.foodItem.findMany({ where: { storeId, id: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines: QuoteLine[] = [];
  for (const item of items) {
    const row = byId.get(item.itemId);
    if (!row) return { ok: false, error: "Item não encontrado no cardápio." };
    const removals = (item.removals ?? []).map((r) => r.trim()).filter(Boolean).slice(0, 12);
    lines.push({
      itemId: row.id,
      name: row.name,
      priceCents: row.priceCents,
      quantity: item.quantity,
      available: row.available,
      removals,
      notes: item.notes?.trim().slice(0, 140) || null,
    });
  }
  return { ok: true, lines };
}

export function publicOrderView(order: {
  number: number;
  publicToken: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentStatus: string;
  fulfillment: string;
  totalCents: number;
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  pixCopyPaste: string | null;
  pixQrCodeBase64: string | null;
  customerName: string;
}) {
  const pixPending = order.paymentMethod === "PIX" && order.paymentStatus === "PENDING";
  return {
    number: order.number,
    publicToken: order.publicToken,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    fulfillmentStatus: order.fulfillmentStatus,
    fulfillment: order.fulfillment,
    totalCents: order.totalCents,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalLabel: money(order.totalCents),
    pixPending,
    pixCopyPaste: pixPending ? order.pixCopyPaste : null,
    pixQrCodeBase64: pixPending ? order.pixQrCodeBase64 : null,
    customerName: order.customerName,
    confirmed: order.paymentStatus === "APPROVED" || order.paymentStatus === "PAY_ON_DELIVERY",
  };
}

export async function previewFoodOrder(input: CreateFoodOrderInput) {
  const priced = await priceCheckout(input);
  if (!priced.ok) return priced;
  return {
    ok: true as const,
    subtotalCents: priced.quote.subtotalCents,
    discountCents: priced.quote.discountCents,
    deliveryFeeCents: priced.quote.deliveryFeeCents,
    totalCents: priced.quote.totalCents,
    couponCode: priced.quote.couponCode,
  };
}

async function priceCheckout(input: CreateFoodOrderInput) {
  const store = await prisma.foodStore.findUnique({ where: { slug: input.slug } });
  if (!store || store.status === "DISABLED") return { ok: false as const, error: "Loja indisponível.", status: 404 };
  const loaded = await loadLines(store.id, input.items);
  if (!loaded.ok) return { ok: false as const, error: loaded.error, status: 400 };
  const couponCode = input.couponCode?.trim().toUpperCase() || "";
  const coupon = couponCode
    ? await prisma.foodCoupon.findFirst({ where: { storeId: store.id, code: couponCode, active: true } })
    : null;
  if (couponCode && !coupon) return { ok: false as const, error: "Cupom não encontrado.", status: 400 };
  const quote = quoteFoodOrder({
    acceptingOrders: store.acceptingOrders && store.status === "PUBLISHED",
    deliveryEnabled: store.deliveryEnabled,
    pickupEnabled: store.pickupEnabled,
    deliveryFeeCents: store.deliveryFeeCents,
    minOrderCents: store.minOrderCents,
    fulfillment: input.fulfillment,
    lines: loaded.lines,
    coupon: coupon ? { code: coupon.code, type: coupon.type === "FIXED" ? "FIXED" : "PERCENT", value: coupon.value } : null,
  });
  if (!quote.ok) return { ok: false as const, error: quote.error, status: 400 };
  return { ok: true as const, store, loaded, quote, coupon };
}

export async function createFoodOrder(input: CreateFoodOrderInput) {
  const phoneE164 = toPhoneE164(input.phone);
  if (!phoneE164) return { ok: false as const, error: "Celular inválido.", status: 400 };
  const name = input.customerName.trim().slice(0, 200);
  if (name.length < 2) return { ok: false as const, error: "Informe seu nome.", status: 400 };
  if (!["PIX", "CARD_ON_DELIVERY", "CASH"].includes(input.paymentMethod)) {
    return { ok: false as const, error: "Forma de pagamento inválida.", status: 400 };
  }
  if (input.fulfillment === "DELIVERY") {
    const a = input.address;
    if (!a?.street?.trim() || !a.number?.trim() || !a.neighborhood?.trim() || !a.cep?.replace(/\D/g, "")) {
      return { ok: false as const, error: "Endereço incompleto.", status: 400 };
    }
  }

  const priced = await priceCheckout(input);
  if (!priced.ok) return priced;
  const { store, loaded, quote } = priced;

  const existing = await prisma.foodOrder.findUnique({
    where: { storeId_clientRequestId: { storeId: store.id, clientRequestId: input.clientRequestId.slice(0, 80) } },
    include: { items: true },
  });
  if (existing) {
    if (existing.paymentMethod === "PIX" && existing.paymentStatus === "PENDING" && !existing.mpOrderId) {
      const charged = await chargePix(existing.id);
      const again = await prisma.foodOrder.findUnique({ where: { id: existing.id }, include: { items: true } });
      return {
        ok: true as const,
        order: publicOrderView(again ?? existing),
        replay: true,
        ...(charged.ok ? {} : { pixError: charged.error }),
      };
    }
    return { ok: true as const, order: publicOrderView(existing), replay: true };
  }

  const { contact, lead } = await upsertPersonAndLead({
    workspaceId: store.clienteId,
    name,
    phone: phoneE164,
    source: "food",
    metadata: { channel: "food", storeSlug: store.slug },
  });

  const payOnDelivery = input.paymentMethod !== "PIX";
  const created = await prisma.$transaction(async (tx) => {
    const numbered = await tx.foodStore.update({
      where: { id: store.id },
      data: { nextNumber: { increment: 1 } },
      select: { nextNumber: true },
    });
    return tx.foodOrder.create({
      data: {
        clienteId: store.clienteId,
        storeId: store.id,
        number: numbered.nextNumber,
        publicToken: randomBytes(16).toString("hex"),
        clientRequestId: input.clientRequestId.slice(0, 80),
        contactId: contact.id,
        leadId: lead.id,
        customerName: name,
        phone: input.phone.trim().slice(0, 40),
        phoneE164,
        fulfillment: input.fulfillment,
        address:
          input.fulfillment === "DELIVERY"
            ? {
                cep: input.address?.cep ?? "",
                street: input.address?.street ?? "",
                number: input.address?.number ?? "",
                complement: input.address?.complement ?? "",
                neighborhood: input.address?.neighborhood ?? "",
              }
            : Prisma.JsonNull,
        paymentMethod: input.paymentMethod,
        paymentStatus: payOnDelivery ? "PAY_ON_DELIVERY" : "PENDING",
        fulfillmentStatus: "NEW",
        subtotalCents: quote.subtotalCents,
        discountCents: quote.discountCents,
        deliveryFeeCents: quote.deliveryFeeCents,
        totalCents: quote.totalCents,
        couponCode: quote.couponCode,
        changeForCents: input.paymentMethod === "CASH" ? input.changeForCents ?? null : null,
        items: {
          create: loaded.lines.map((line) => ({
            itemId: line.itemId,
            name: line.name,
            priceCents: line.priceCents,
            quantity: line.quantity,
            removals: line.removals,
            notes: line.notes,
          })),
        },
        events: { create: { kind: "created", toValue: payOnDelivery ? "PAY_ON_DELIVERY" : "PENDING" } },
      },
      include: { items: true },
    });
  });

  await notify({
    clienteId: store.clienteId,
    type: "food.order",
    title: `Novo pedido #${created.number}`,
    body: `${name} · ${money(created.totalCents)} · ${payOnDelivery ? "pagamento na entrega" : "Pix"}`,
    href: "/food",
    severity: "aviso",
    dedupeKey: `food-order:${created.id}`,
  }).catch(() => null);

  if (created.paymentMethod === "PIX") {
    const charged = await chargePix(created.id);
    if (!charged.ok) {
      return { ok: true as const, order: publicOrderView(created), pixError: charged.error };
    }
    const fresh = await prisma.foodOrder.findUnique({ where: { id: created.id } });
    await enrollUnpaid(created).catch(() => null);
    return { ok: true as const, order: publicOrderView(fresh ?? created) };
  }

  return { ok: true as const, order: publicOrderView(created) };
}

async function enrollUnpaid(order: { id: string; clienteId: string; contactId: string | null; leadId: string | null; totalCents: number; number: number; publicToken: string }) {
  if (!order.contactId) return;
  await enrollContact({
    clienteId: order.clienteId,
    trigger: "order_unpaid",
    contactId: order.contactId,
    leadId: order.leadId,
    refType: "order",
    refId: order.id,
    dedupeKey: `food-unpaid:${order.id}`,
    context: {
      totalCents: order.totalCents,
      orderRef: String(order.number),
      destination: `/cardapio/pedido/${order.publicToken}`,
      provider: "FOOD",
    },
  });
}

async function chargePix(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.foodOrder.findUnique({ where: { id: orderId }, include: { items: true, store: true } });
  if (!order || order.paymentMethod !== "PIX" || order.paymentStatus !== "PENDING" || order.mpOrderId) {
    return { ok: true };
  }
  try {
    const mp = await createMercadoPagoOrder({
      workspaceId: order.clienteId,
      externalReference: `${FOOD_REF_PREFIX}${order.id}`,
      amount: order.totalCents / 100,
      description: `Pedido ${order.store.name} #${order.number}`,
      payer: {
        email: payerEmail(order.phoneE164 || order.phone),
        firstName: order.customerName.split(" ")[0],
        lastName: order.customerName.split(" ").slice(1).join(" ") || undefined,
      },
      payment: { type: "bank_transfer", paymentMethodId: "pix" },
    });
    const pix = mp.transactions?.payments?.[0]?.payment_method;
    await prisma.foodOrder.update({
      where: { id: order.id },
      data: {
        mpOrderId: mp.id,
        pixQrCode: pix?.qr_code ?? null,
        pixQrCodeBase64: pix?.qr_code_base64 ?? null,
        pixCopyPaste: pix?.qr_code ?? null,
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao criar o Pix." };
  }
}

export async function markFoodPaid(orderId: string) {
  const order = await prisma.foodOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.paymentStatus === "APPROVED") return order;

  const updated = await prisma.foodOrder.update({
    where: { id: orderId },
    data: { paymentStatus: "APPROVED", paidAt: new Date() },
    include: { items: true },
  });

  let leadId = updated.leadId;
  if (updated.contactId) {
    const pipeline = await prisma.crmPipeline.findFirst({
      where: { clienteId: updated.clienteId, isDefault: true },
      include: { stages: true },
    });
    const won = pipeline?.stages.find((s) => s.role === "WON");
    const lead = await prisma.nativeLead.findFirst({
      where: { clienteId: updated.clienteId, contactId: updated.contactId, status: { in: ["OPEN", "WON"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (lead) {
      leadId = lead.id;
      await prisma.nativeLead.update({
        where: { id: lead.id },
        data: {
          status: "WON",
          stageId: won?.id ?? lead.stageId,
          dealValue: new Prisma.Decimal(updated.totalCents / 100),
        },
      });
    }
  }

  await upsertLedgerEntry({
    clienteId: updated.clienteId,
    type: "INCOME",
    amount: updated.totalCents / 100,
    occurredAt: updated.paidAt ?? new Date(),
    source: "food",
    sourceRef: updated.id,
    idempotencyKey: `food-order-${updated.id}`,
    leadId,
    contact: updated.phoneE164 || updated.phone,
    provider: updated.paymentMethod === "PIX" ? "MERCADO_PAGO" : "FOOD",
    description: `Pedido Food #${updated.number}`,
  });

  const { onOrderPaid } = await import("@/lib/flows/attribution");
  await onOrderPaid({
    workspaceId: updated.clienteId,
    contactId: updated.contactId,
    leadId,
    phone: updated.phoneE164 || updated.phone,
    orderRef: `FOOD:${updated.id}`,
    totalCents: updated.totalCents,
    paidAt: updated.paidAt ?? new Date(),
    provider: "FOOD",
    couponCodes: updated.couponCode ? [updated.couponCode] : [],
    items: updated.items.map((i) => ({ title: i.name, quantity: i.quantity, unitPriceCents: i.priceCents })),
  }).catch((err) => console.error("[food-flows]", err));

  await prisma.foodOrderEvent.create({
    data: { orderId: updated.id, kind: "payment", fromValue: order.paymentStatus, toValue: "APPROVED" },
  });
  return updated;
}

export async function markFoodRefunded(orderId: string) {
  const order = await prisma.foodOrder.findUnique({ where: { id: orderId } });
  if (!order || order.paymentStatus === "REFUNDED") return order;
  const updated = await prisma.foodOrder.update({
    where: { id: orderId },
    data: { paymentStatus: "REFUNDED" },
  });
  if (order.paymentStatus === "APPROVED") {
    await upsertLedgerEntry({
      clienteId: order.clienteId,
      type: "REFUND",
      amount: order.totalCents / 100,
      occurredAt: new Date(),
      source: "food",
      sourceRef: order.id,
      idempotencyKey: `food-refund-${order.id}`,
      contact: order.phoneE164 || order.phone,
      provider: "MERCADO_PAGO",
      description: `Estorno Food #${order.number}`,
    });
  }
  return updated;
}

function mpStatus(raw: string) {
  const s = raw.toLowerCase();
  if (["processed", "approved", "paid"].some((x) => s.includes(x))) return "paid" as const;
  if (s.includes("refund")) return "refunded" as const;
  if (["cancelled", "canceled", "rejected", "chargeback"].some((x) => s.includes(x))) return "rejected" as const;
  return "pending" as const;
}

export async function applyFoodPaymentWebhook(input: { orderId?: string | null; mpOrderId?: string | null; hintedStatus?: string }) {
  const order = input.orderId
    ? await prisma.foodOrder.findUnique({ where: { id: input.orderId } })
    : input.mpOrderId
      ? await prisma.foodOrder.findFirst({ where: { mpOrderId: input.mpOrderId } })
      : null;
  if (!order) return null;
  let status = input.hintedStatus ?? "";
  const lookup = order.mpOrderId || input.mpOrderId;
  if (lookup) {
    try {
      const mp = await getMercadoPagoOrder(order.clienteId, lookup);
      status = String(mp.status || status);
      if (!order.mpOrderId && mp.id) {
        await prisma.foodOrder.update({ where: { id: order.id }, data: { mpOrderId: String(mp.id) } });
      }
    } catch {
      /* mantém o status informado */
    }
  }
  const kind = mpStatus(status);
  if (kind === "paid") return markFoodPaid(order.id);
  if (kind === "refunded") return markFoodRefunded(order.id);
  if (kind === "rejected" && order.paymentStatus === "PENDING") {
    return prisma.foodOrder.update({ where: { id: order.id }, data: { paymentStatus: "REJECTED" } });
  }
  return order;
}

export async function advanceFoodOrder(input: { clienteId: string; orderId: string; to: string }) {
  const order = await prisma.foodOrder.findFirst({
    where: { id: input.orderId, clienteId: input.clienteId },
  });
  if (!order) return { ok: false as const, error: "Pedido não encontrado.", status: 404 };
  const fulfillment = order.fulfillment === "PICKUP" ? "PICKUP" : "DELIVERY";
  if (!canTransitionFulfillment(fulfillment, order.fulfillmentStatus, input.to)) {
    return { ok: false as const, error: "Essa mudança de estado não é permitida.", status: 400 };
  }
  const updated = await prisma.foodOrder.update({
    where: { id: order.id },
    data: { fulfillmentStatus: input.to },
  });
  await prisma.foodOrderEvent.create({
    data: { orderId: order.id, kind: "fulfillment", fromValue: order.fulfillmentStatus, toValue: input.to },
  });
  await sendFoodStatusMessage(updated).catch((err) => console.error("[food-status]", err));
  return { ok: true as const, order: updated };
}

export async function receiveFoodPayment(input: { clienteId: string; orderId: string }) {
  const order = await prisma.foodOrder.findFirst({
    where: { id: input.orderId, clienteId: input.clienteId },
  });
  if (!order) return { ok: false as const, error: "Pedido não encontrado.", status: 404 };
  if (order.paymentStatus !== "PAY_ON_DELIVERY") {
    return { ok: false as const, error: "Este pedido não está aguardando pagamento na entrega.", status: 400 };
  }
  await markFoodPaid(order.id);
  return { ok: true as const };
}
