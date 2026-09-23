/**
 * Envios Mercado Livre (Full / Flex / ME2…).
 * Doc: https://developers.mercadolivre.com.br/pt_br/gerenciamento-de-envios
 */

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

/** Label amigável Full / Flex / Correios etc. */
export function shippingLabel(mode: string | null, logisticType: string | null) {
  const logistic = (logisticType || "").toLowerCase();
  const m = (mode || "").toLowerCase();
  if (logistic.includes("fulfillment") || logistic === "fbm") return "Full";
  if (logistic.includes("flex") || m.includes("flex")) return "Flex";
  if (logistic.includes("self_service") || logistic.includes("turbo")) return "Turbo / Próprio";
  if (m === "me2" || m === "me1") return "Mercado Envios";
  if (m === "custom") return "Personalizado";
  return logisticType || mode || "—";
}
