import type { RenderContext, RenderItem } from "@/lib/flows/types";

export const TEMPLATE_VARIABLES = [
  { key: "nome", label: "Nome completo" },
  { key: "primeiro_nome", label: "Primeiro nome" },
  { key: "loja", label: "Nome da loja" },
  { key: "cupom", label: "Código do cupom" },
  { key: "validade", label: "Validade do cupom" },
  { key: "itens", label: "Itens (texto)" },
  { key: "produto", label: "Primeiro produto" },
  { key: "total", label: "Total" },
  { key: "link", label: "Link principal" },
] as const;

export function formatMoney(cents: number | null | undefined, currency = "BRL") {
  if (cents == null) return "";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency });
}

export function firstName(name: string | null | undefined) {
  const n = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!n || /@/.test(n) || /^\+?\d+$/.test(n)) return "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

export function itemsText(items: RenderItem[]) {
  return items
    .slice(0, 5)
    .map((i) => `${i.quantity && i.quantity > 1 ? `${i.quantity}x ` : ""}${i.title}`)
    .join(", ");
}

export function variableValues(ctx: Omit<RenderContext, "trackUrl">): Record<string, string> {
  const fn = firstName(ctx.contactName);
  return {
    nome: (ctx.contactName ?? "").trim() || "cliente",
    primeiro_nome: fn,
    loja: ctx.storeName,
    cupom: ctx.couponCode ?? "",
    validade: ctx.couponExpires ?? "",
    itens: itemsText(ctx.items),
    produto: ctx.items[0]?.title ?? "",
    total: formatMoney(ctx.totalCents, ctx.currency),
    link: ctx.primaryUrl,
  };
}

/** Substitui {{var}}. Variável desconhecida vira vazio; espaços duplos são limpos. */
export function interpolate(text: string, values: Record<string, string>) {
  return text
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => values[k.toLowerCase()] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1");
}
