/**
 * Métrica principal de "resultado" no dashboard.
 *
 * Para clientes de compras (Granarolo, D'or): usa `conversoes` diretamente.
 * Isso evita que `leads` (ações de engajamento registradas pela Meta)
 * sobrescrevam o número real de compras no site.
 *
 * Para os demais clientes:
 * - Geração de leads: leads > 0, conversoes = 0  → retorna leads
 * - E-commerce padrão (leads = 0): conversoes = purchases → retorna conversoes
 * - Google Ads: leads = 0, conversoes = primary conversions → retorna conversoes
 * - Fallback WhatsApp/Messenger: retorna conversas
 */
export function outcomeCountForFato(
  _canal: string,
  leads: number,
  conversoes: number,
  conversas?: number,
  isCompras?: boolean
): number {
  if (isCompras) return conversoes;
  const primary = Math.max(leads, conversoes);
  if (primary > 0) return primary;
  return conversas ?? 0;
}
