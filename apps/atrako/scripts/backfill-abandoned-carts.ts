/**
 * Backfill do funil de e-commerce (Woo, Shopify, Nuvemshop, Tray), histórico inteiro:
 *  1. pedido pago → Ganho; não pago ≤30d → carrinho; não pago >30d / reembolso → Perdido
 *     (o contato fica na base para reativação);
 *  2. puxa checkouts abandonados das lojas conectadas (30 dias);
 *  3. promove carrinhos vencidos para a coluna "Carrinho abandonado".
 *
 * Sem WhatsApp por padrão (--notify envia para carrinhos com menos de 24h).
 * Dry-run por padrão. Uso:
 *   npx tsx scripts/backfill-abandoned-carts.ts [--workspace <clienteId>] [--apply] [--notify]
 */
import "./server-only-shim.cjs";
import "dotenv/config";
import { prisma } from "@/lib/db";
import {
  markLeadLost,
  RECOVERY_WINDOW_DAYS,
  runAbandonedCartSweep,
  trackOrderPayment,
  type AbandonedCartProvider,
} from "@/lib/crm/abandoned-cart";
import { pollAbandonedCheckouts } from "@/lib/crm/abandoned-checkout-poll";
import {
  isWooPaidOrder,
  isWooRefundedOrder,
  isWooUnpaidOrder,
  wooOrderItems,
  type WooOrder,
} from "@/lib/integrations/woocommerce/orders";
import {
  extractShopifyLineItems,
  isShopifyPaidStatus,
  isShopifyRefundedStatus,
  isShopifyUnpaidStatus,
  shopifyOrderStatus,
  type ShopifyOrder,
} from "@/lib/integrations/shopify/orders";
import {
  extractNuvemshopLineItems,
  isNuvemshopPaidStatus,
  isNuvemshopRefundedStatus,
  isNuvemshopUnpaidStatus,
  nuvemshopOrderStatus,
  type NuvemshopOrder,
} from "@/lib/integrations/nuvemshop/orders";
import {
  extractTrayLineItems,
  isTrayPaidStatus,
  isTrayRefundedOrder,
  isTrayUnpaidOrder,
  trayOrderPaymentUrl,
  type TrayOrder,
} from "@/lib/integrations/tray/orders";

type OrderState = "paid" | "unpaid" | "refunded";
type Item = { title: string; quantity: number; unitPriceCents: number; sku: string | null };
type Classified = { state: OrderState; items: Item[]; recoveryUrl?: string | null } | null;

function stateOf(paid: boolean, unpaid: boolean, refunded: boolean): OrderState | null {
  if (refunded) return "refunded";
  if (paid) return "paid";
  if (unpaid) return "unpaid";
  return null;
}

function classify(provider: string, stored: unknown): Classified {
  if (!stored || typeof stored !== "object") return null;
  // Ingestão guarda { order, notification }.
  const raw = (stored as { order?: unknown }).order ?? stored;
  if (!raw || typeof raw !== "object") return null;
  switch (provider) {
    case "WOOCOMMERCE": {
      const o = raw as WooOrder;
      const state = stateOf(isWooPaidOrder(o), isWooUnpaidOrder(o), isWooRefundedOrder(o));
      return state ? { state, items: wooOrderItems(o), recoveryUrl: o.payment_url } : null;
    }
    case "SHOPIFY": {
      const s = shopifyOrderStatus(raw as ShopifyOrder);
      const state = stateOf(isShopifyPaidStatus(s), isShopifyUnpaidStatus(s), isShopifyRefundedStatus(s));
      return state ? { state, items: extractShopifyLineItems(raw as ShopifyOrder) } : null;
    }
    case "NUVEMSHOP": {
      const s = nuvemshopOrderStatus(raw as NuvemshopOrder);
      const state = stateOf(
        isNuvemshopPaidStatus(s),
        isNuvemshopUnpaidStatus(s),
        isNuvemshopRefundedStatus(s),
      );
      return state ? { state, items: extractNuvemshopLineItems(raw as NuvemshopOrder) } : null;
    }
    case "TRAY": {
      const o = raw as TrayOrder;
      const state = stateOf(isTrayPaidStatus(o), isTrayUnpaidOrder(o), isTrayRefundedOrder(o));
      return state
        ? { state, items: extractTrayLineItems(o), recoveryUrl: trayOrderPaymentUrl(o) }
        : null;
    }
    default:
      return null;
  }
}

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const notify = process.argv.includes("--notify");
  const workspaceId = argValue("--workspace") ?? undefined;
  const windowStart = Date.now() - RECOVERY_WINDOW_DAYS * 86_400_000;

  // Ordem cronológica: o pagamento posterior apaga/recupera o carrinho do pedido anterior.
  const orders = await prisma.marketplaceOrder.findMany({
    where: {
      provider: { in: ["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY"] },
      ...(workspaceId ? { clienteId: workspaceId } : {}),
    },
    orderBy: { occurredAt: "asc" },
  });

  const tally = { pago: 0, naoPagoRecente: 0, naoPagoAntigo: 0, reembolso: 0, ignorado: 0 };
  for (const o of orders) {
    const c = classify(o.provider, o.rawPayload);
    const occurredAt = o.occurredAt ?? o.createdAt;
    if (!c) {
      tally.ignorado++;
      continue;
    }
    if (c.state === "paid") tally.pago++;
    else if (c.state === "refunded") tally.reembolso++;
    else if (occurredAt.getTime() >= windowStart) tally.naoPagoRecente++;
    else tally.naoPagoAntigo++;
    if (!apply) continue;

    if (c.state === "refunded") {
      if (o.leadId) {
        await markLeadLost(o.clienteId, o.leadId, "reembolso", {
          lostOrderRef: `${o.provider}:${o.externalId}`,
        });
      }
      continue;
    }
    await trackOrderPayment({
      workspaceId: o.clienteId,
      provider: o.provider as AbandonedCartProvider,
      externalOrderId: o.externalId,
      paid: c.state === "paid",
      occurredAt,
      totalCents: o.totalCents ?? 0,
      currency: o.currency,
      contactId: o.contactId,
      leadId: o.leadId,
      name: o.buyerName,
      email: o.buyerEmail,
      phone: o.buyerPhone,
      items: c.items,
      recoveryUrl: c.recoveryUrl ?? null,
    });
  }
  console.log(`Pedidos (histórico): ${orders.length}`, tally);

  if (!apply) {
    const connections = await prisma.workspaceConnection.count({
      where: {
        status: "ACTIVE",
        provider: { in: ["SHOPIFY", "NUVEMSHOP", "TRAY"] },
        ...(workspaceId ? { clienteId: workspaceId } : {}),
      },
    });
    console.log(`Lojas com API de checkout abandonado conectadas: ${connections}`);
    console.log("Dry-run. Rode com --apply para gravar.");
    return;
  }

  const checkouts = await pollAbandonedCheckouts({ workspaceId, full: true });
  console.log("Checkouts das lojas:", checkouts);

  const sweep = await runAbandonedCartSweep({ notify });
  console.log("Varredura:", sweep);

  const byStatus = await prisma.abandonedCart.groupBy({
    by: ["status"],
    where: workspaceId ? { clienteId: workspaceId } : {},
    _count: { _all: true },
    _sum: { totalCents: true },
  });
  console.log(
    "Carrinhos:",
    byStatus.map((r) => ({
      status: r.status,
      count: r._count._all,
      total: `R$ ${((r._sum.totalCents ?? 0) / 100).toFixed(2)}`,
    })),
  );

  const funnel = await prisma.$queryRaw<Array<{ stage: string; status: string; n: number }>>`
    SELECT s.name AS stage, l.status, count(*)::int AS n
    FROM "NativeLead" l
    JOIN "CrmStage" s ON s.id = l."stageId"
    WHERE (${workspaceId ?? null}::text IS NULL OR l."clienteId" = ${workspaceId ?? null})
    GROUP BY s.name, s."order", l.status
    ORDER BY s."order"
  `;
  console.log("Funil:", funnel);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
