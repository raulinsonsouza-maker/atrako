/**
 * Envios Mercado Livre (Full / Flex / ME2…).
 * Doc: https://developers.mercadolivre.com.br/pt_br/gerenciamento-de-envios
 */

import { mlShippingLabel } from "./buyer-facts";
import { mlFetch } from "./client";

export type MlShipment = {
  id: number;
  order_id?: number;
  status?: string;
  mode?: string;
  logistic_type?: string;
  shipping_option?: {
    list_cost?: number;
    cost?: number;
    name?: string;
  };
  lead_time?: {
    cost?: number;
  };
  receiver_address?: {
    receiver_name?: string;
  };
};

export async function getMlShipment(workspaceId: string, shipmentId: string | number) {
  return mlFetch<MlShipment>(workspaceId, `/shipments/${shipmentId}`);
}

export function extractShippingEconomics(shipment: MlShipment): {
  shippingId: string;
  shippingStatus: string | null;
  shippingMode: string | null;
  logisticType: string | null;
  shippingCostCents: number;
  orderId: string | null;
} {
  const cost =
    typeof shipment.shipping_option?.list_cost === "number"
      ? shipment.shipping_option.list_cost
      : typeof shipment.shipping_option?.cost === "number"
        ? shipment.shipping_option.cost
        : typeof shipment.lead_time?.cost === "number"
          ? shipment.lead_time.cost
          : 0;

  return {
    shippingId: String(shipment.id),
    shippingStatus: shipment.status ?? null,
    shippingMode: shipment.mode ?? null,
    logisticType: shipment.logistic_type ?? null,
    shippingCostCents: Math.round(cost * 100),
    orderId: shipment.order_id != null ? String(shipment.order_id) : null,
  };
}

/** Label amigável Full / Flex / Mercado Envios. */
export function shippingLabel(mode: string | null, logisticType: string | null) {
  return mlShippingLabel(mode, logisticType) ?? "—";
}

/** Chave estável para filtrar Full / Flex / Mercado Envios. */
export function shippingFacetKey(mode: string | null, logisticType: string | null) {
  const label = mlShippingLabel(mode, logisticType);
  if (label === "Full") return "full";
  if (label === "Flex") return "flex";
  if (label === "Turbo / Próprio") return "turbo";
  if (label === "Mercado Envios") return "me";
  if (label === "Personalizado") return "custom";
  return "outro";
}
