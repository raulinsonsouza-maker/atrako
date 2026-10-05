/** Cancelado, reembolsado, não pago ou rascunho não é receita (Woo, Tray, Shopify, ML, Shopee…). */
const NOT_REVENUE =
  /cancel|refund|reembols|estorn|devolv|fail|falh|trash|draft|unpaid|pending|pendente|aguardando (pagamento|vindi)|expired|expirad/;

export function isRevenueOrder(status: string | null | undefined): boolean {
  return !NOT_REVENUE.test((status ?? "").toLowerCase());
}
