/** Cancelado, reembolsado, não pago ou rascunho não é receita (Woo, Tray, Shopify, ML, Shopee…). */
const NOT_REVENUE =
  /cancel|refund|reembols|estorn|devolv|fail|falh|trash|draft|unpaid|pending|pendente|aguardando (pagamento|vindi)|expired|expirad/;

export function isRevenueOrder(status: string | null | undefined): boolean {
  return !NOT_REVENUE.test((status ?? "").toLowerCase());
}

/**
 * Status de pedido pago / concretizado por provider.
 * Woo: processing/completed · genérico: paid/approved · Olist ERP: aprovada→entregue
 * (não usar só "aprovado" — a Olist grava "aprovada").
 */
export const PAID_STATUSES = new Set([
  // Woo / genérico
  "processing",
  "completed",
  "paid",
  "approved",
  "authorized",
  "pago",
  "aprovado",
  // Olist ERP (isOlistPaid)
  "aprovada",
  "preparando_envio",
  "faturada",
  "pronto_envio",
  "enviada",
  "entregue",
]);

/** Venda concretizada (pagamento confirmado). Mais restrito que `isRevenueOrder`: `on-hold` não conta. */
export function isPaidOrderStatus(status: string | null | undefined): boolean {
  return PAID_STATUSES.has((status ?? "").toLowerCase());
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
  aprovada: "Aprovada",
  preparando_envio: "Preparando envio",
  faturada: "Faturada",
  pronto_envio: "Pronto para envio",
  enviada: "Enviada",
  entregue: "Entregue",
};

/** Status da loja em português (Tray já vem em PT, só normaliza a caixa). */
export function orderStatusLabel(status: string | null | undefined) {
  if (!status) return null;
  const mapped = ORDER_STATUS_LABELS[status.toLowerCase()];
  if (mapped) return mapped;
  const lower = status.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
