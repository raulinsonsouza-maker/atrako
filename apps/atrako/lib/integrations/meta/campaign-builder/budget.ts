/** Orçamento Meta: API espera unidade monetária mínima (centavos). */

export function toMetaBudget(amountReais: number): number {
  if (!Number.isFinite(amountReais) || amountReais < 0) return 0;
  return Math.round(amountReais * 100);
}

export function fromMetaBudget(amountCents: number): number {
  if (!Number.isFinite(amountCents)) return 0;
  return amountCents / 100;
}

export function formatBudgetBrl(amountReais: number): string {
  return amountReais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
