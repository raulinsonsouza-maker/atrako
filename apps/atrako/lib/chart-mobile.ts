/** Eixos de gráfico no celular: rótulos curtos ("12,3 mil") e no máximo ~6 ticks. */
const compactNumber = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function formatCompactNumber(value: number) {
  return compactNumber.format(value);
}

export function mobileTickInterval(points: number, maxTicks = 6) {
  return points > maxTicks ? Math.ceil(points / maxTicks) - 1 : 0;
}
