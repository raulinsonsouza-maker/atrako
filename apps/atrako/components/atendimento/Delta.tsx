/** Variação contra o período anterior; `invert` quando subir é ruim (custos). */
export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null || value === 0) return null;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={good ? "text-[var(--success)]" : "text-[var(--danger)]"}>
      {value > 0 ? "+" : ""}
      {value}% vs anterior
    </span>
  );
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
