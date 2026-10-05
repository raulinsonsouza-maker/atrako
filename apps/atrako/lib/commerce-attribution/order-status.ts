/** Cancelado, reembolsado, não pago ou rascunho não é receita (Woo, Tray, Shopify, ML, Shopee…). */
const NOT_REVENUE =
  /cancel|refund|reembols|estorn|devolv|fail|falh|trash|draft|unpaid|pending|pendente|aguardando (pagamento|vindi)|expired|expirad/;

export function isRevenueOrder(status: string | null | undefined): boolean {
  return !NOT_REVENUE.test((status ?? "").toLowerCase());
}

/** Pedido encerrado sem pagamento possível (link de pagamento não funciona mais). */
const CLOSED = /cancel|refund|reembols|estorn|devolv|fail|falh|trash|expired|expirad|voided/;

export function isClosedOrder(status: string | null | undefined): boolean {
  return CLOSED.test((status ?? "").toLowerCase());
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando pagamento",
  "on-hold": "Aguardando pagamento",
  processing: "Pago",
  completed: "Concluído",
  cancelled: "Cancelado",
  failed: "Pagamento recusado",
  refunded: "Reembolsado",
  paid: "Pago",
  partially_paid: "Pago parcialmente",
  authorized: "Pagamento autorizado",
  voided: "Cancelado",
  expired: "Expirado",
  abandoned: "Abandonado",
};

/** Status da loja em português (Tray já vem em PT, só normaliza a caixa). */
export function orderStatusLabel(status: string | null | undefined) {
  if (!status) return null;
  const mapped = ORDER_STATUS_LABELS[status.toLowerCase()];
  if (mapped) return mapped;
  const lower = status.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
