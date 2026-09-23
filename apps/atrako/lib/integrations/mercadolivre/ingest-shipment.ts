/**
 * Ingestão de envio ML → atualiza frete/modalidade/custo no MarketplaceOrder.
 */

import { prisma } from "@/lib/db";
import {
  extractShippingEconomics,
  getMlShipment,
} from "./shipments";

export async function ingestMercadoLivreShipment(input: {
  workspaceId: string;
  shipmentId: string | number;
}) {
  const shipment = await getMlShipment(input.workspaceId, input.shipmentId);
  const econ = extractShippingEconomics(shipment);

  let order = econ.orderId
    ? await prisma.marketplaceOrder.findUnique({
        where: {
          clienteId_provider_externalId: {
            clienteId: input.workspaceId,
            provider: "MERCADO_LIVRE",
            externalId: econ.orderId,
          },
        },
      })
    : null;

  if (!order) {
    order = await prisma.marketplaceOrder.findFirst({
      where: {
        clienteId: input.workspaceId,
        provider: "MERCADO_LIVRE",
        shippingId: econ.shippingId,
      },
    });
  }

  if (!order) {
    return { updated: false as const, reason: "order_not_found" as const };
  }

  const saleFeeCents = order.saleFeeCents ?? 0;
  const totalCents = order.totalCents ?? 0;
  const shippingCostCents = econ.shippingCostCents;
  const netCents = totalCents - saleFeeCents - shippingCostCents;

  const updated = await prisma.marketplaceOrder.update({
    where: { id: order.id },
    data: {
      shippingId: econ.shippingId,
      shippingStatus: econ.shippingStatus,
      shippingMode: econ.shippingMode,
      logisticType: econ.logisticType,
      shippingCostCents,
      netCents,
    },
  });

  return { updated: true as const, order: updated };
}
