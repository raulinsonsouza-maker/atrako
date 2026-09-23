type Totals = {
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  purchases: number;
  faturamento: number;
};

export type HotelCampaignDriver = {
  identifier: string;
  name: string;
  channel: string;
  investment: number;
  revenue: number;
  sales: number;
  resultLabel: "vendas" | "conversões";
  valueLabel: "receita" | "valor de conversão";
  roas: number | null;
  comparison: "new" | "stopped" | "up" | "down" | "stable";
  investmentChangePct: number | null;
  revenueChangePct: number | null;
};

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Compares ratios only when both periods have a valid denominator. */
export function ratioPercentChange(
  currentNumerator: number,
  currentDenominator: number,
  previousNumerator: number,
  previousDenominator: number
): number | null {
  if (currentDenominator <= 0 || previousDenominator <= 0) return null;
  return percentChange(currentNumerator / currentDenominator, previousNumerator / previousDenominator);
}

export type ComparisonPeriod = { start: Date; end: Date };

/** Uses local calendar dates only; never serializes through UTC. */
export function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function relativeAnalystPeriod(
  constraints: readonly string[],
  now = new Date(),
): ComparisonPeriod | null {
  const today = saoPauloCalendarDate(now);
  if (constraints.includes("limite o período a ontem")) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: yesterday, end: new Date(yesterday) };
  }
  if (constraints.includes("limite o período a hoje")) return { start: today, end: new Date(today) };
  if (constraints.includes("limite o período a esta semana")) {
    const start = new Date(today);
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - weekday + 1);
    return { start, end: today };
  }
  if (constraints.includes("limite o período a este mês")) {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }
  const rolling = constraints.find((item) => /^limite o período aos últimos \d{1,3} dias$/.test(item));
  if (rolling) {
    const days = Number(rolling.match(/\d{1,3}/)?.[0]);
    if (days >= 1 && days <= 366) {
      const start = new Date(today);
      start.setDate(start.getDate() - days + 1);
      return { start, end: today };
    }
  }
  return null;
}

export function saoPauloCalendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Number(value.year), Number(value.month) - 1, Number(value.day));
}

export function previousPeriod(start: Date, end: Date, preset?: string | null): ComparisonPeriod {
  const currentStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const currentEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (preset === "mesAtual") {
    const maxDay = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0).getDate();
    return {
      start: new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, Math.min(currentStart.getDate(), maxDay)),
      end: new Date(currentEnd.getFullYear(), currentEnd.getMonth() - 1, Math.min(currentEnd.getDate(), maxDay)),
    };
  }
  if (preset === "mesAnterior") {
    return {
      start: new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1),
      end: new Date(currentStart.getFullYear(), currentStart.getMonth(), 0),
    };
  }
  const days = Math.round((currentEnd.getTime() - currentStart.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(currentStart); previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - days + 1);
  return { start: previousStart, end: previousEnd };
}

export function derived(t: Totals) {
  return {
    ...t,
    ctr: t.impressoes > 0 ? (t.cliques / t.impressoes) * 100 : null,
    cpc: t.cliques > 0 ? t.investimento / t.cliques : null,
    cpl: t.leads > 0 ? t.investimento / t.leads : null,
    cpa: t.purchases > 0 ? t.investimento / t.purchases : null,
    roas: t.investimento > 0 ? t.faturamento / t.investimento : null,
    ticketMedio: t.purchases > 0 ? t.faturamento / t.purchases : null,
    conversaoLeadVenda: t.leads > 0 ? (t.purchases / t.leads) * 100 : null,
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null) => v == null ? "sem base comparável" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export function buildHotelNarrative(input: {
  question: string;
  channel: string;
  current: ReturnType<typeof derived>;
  previous: ReturnType<typeof derived>;
  drivers: HotelCampaignDriver[];
}) {
  const { question, channel, current, previous, drivers } = input;
  const q = question.toLocaleLowerCase("pt-BR");
  const revenueDelta = percentChange(current.faturamento, previous.faturamento);
  const spendDelta = percentChange(current.investimento, previous.investimento);
  const salesDelta = percentChange(current.purchases, previous.purchases);
  const roasDelta = current.roas == null || previous.roas == null
    ? null
    : percentChange(current.roas, previous.roas);
  const leader = drivers[0];
  const isGoogle = channel === "google";
  const isMixed = channel === "geral";
  const resultPlural = isGoogle ? "conversões" : isMixed ? "resultados" : "vendas";
  const valueLabel = isGoogle ? "valor de conversão" : isMixed ? "valor atribuído" : "receita";

  let directAnswer = `No período, ${channel} investiu ${brl(current.investimento)}, gerou ${current.purchases} ${resultPlural} e ${brl(current.faturamento)} em ${valueLabel}, com retorno ${current.roas?.toFixed(2) ?? "indisponível"}x.`;
  if (/melhor|campanha|driver|respons[aá]vel/.test(q)) {
    directAnswer = leader
      ? `${leader.name} foi o principal driver: ${brl(leader.revenue)} de ${leader.valueLabel}, ${leader.sales} ${leader.resultLabel} e retorno ${leader.roas?.toFixed(2) ?? "indisponível"}x.`
      : "Não há campanha com entrega suficiente no período para apontar um driver.";
  } else if (/pior|caiu|queda|mudou|compar/.test(q)) {
    directAnswer = `Contra o período anterior equivalente, o ${valueLabel} variou ${pct(revenueDelta)}, os ${resultPlural} ${pct(salesDelta)} e o investimento ${pct(spendDelta)}. O retorno variou ${pct(roasDelta)}.`;
  } else if (/funil|lead|convers/.test(q)) {
    directAnswer = isGoogle
      ? `O funil Google registrou ${current.impressoes.toLocaleString("pt-BR")} impressões, ${current.cliques.toLocaleString("pt-BR")} cliques e ${current.purchases.toLocaleString("pt-BR")} conversões.`
      : `O funil registrou ${current.impressoes.toLocaleString("pt-BR")} impressões, ${current.cliques.toLocaleString("pt-BR")} cliques, ${current.leads.toLocaleString("pt-BR")} leads e ${current.purchases.toLocaleString("pt-BR")} ${isMixed ? "resultados" : "vendas"}.`;
  } else if (/roas|rentab|efici/.test(q)) {
    directAnswer = `O retorno foi ${current.roas?.toFixed(2) ?? "indisponível"}x (${pct(roasDelta)} versus o período anterior), com custo por ${isGoogle ? "conversão" : isMixed ? "resultado" : "venda"} de ${current.cpa == null ? "indisponível" : brl(current.cpa)}.`;
  }

  const evidence = [
    `Investimento: ${brl(current.investimento)} (${pct(spendDelta)} vs. anterior).`,
    `${valueLabel[0].toUpperCase()}${valueLabel.slice(1)}: ${brl(current.faturamento)} (${pct(revenueDelta)} vs. anterior).`,
    `${resultPlural[0].toUpperCase()}${resultPlural.slice(1)}: ${current.purchases.toLocaleString("pt-BR")} (${pct(salesDelta)} vs. anterior).`,
    `ROAS: ${current.roas?.toFixed(2) ?? "—"}x; CTR: ${current.ctr?.toFixed(2) ?? "—"}%.`,
  ];
  const funnelReading = isGoogle
    ? current.cliques === 0
      ? "Não houve cliques; não é possível calcular a passagem do topo para conversões."
      : current.purchases === 0
        ? "Houve tráfego, mas nenhuma conversão registrada no Google Ads."
        : `Foram registradas ${current.purchases.toLocaleString("pt-BR")} conversões, com custo por conversão ${current.cpa == null ? "—" : brl(current.cpa)}.`
    : current.cliques === 0
    ? "Não houve cliques; não é possível calcular a passagem do topo para o meio do funil."
    : current.leads === 0
      ? "Houve tráfego, mas nenhum lead registrado. Verifique mensuração e aderência da página/oferta."
      : current.purchases === 0
        ? `Há leads, mas nenhum ${isMixed ? "resultado" : "registro de venda"} atribuído. A etapa após o lead é o principal ponto de perda.`
        : `A conversão de lead em ${isMixed ? "resultado" : "venda"} foi ${current.conversaoLeadVenda?.toFixed(1) ?? "—"}%, com CPL ${current.cpl == null ? "—" : brl(current.cpl)} e custo por ${isMixed ? "resultado" : "venda"} ${current.cpa == null ? "—" : brl(current.cpa)}.`;
  const attentionPoints: string[] = [];
  if (current.faturamento === 0 && current.investimento > 0) attentionPoints.push(`Existe investimento sem ${valueLabel}; o retorno não pode ser calculado.`);
  if (current.purchases === 0 && current.investimento > 0) attentionPoints.push(`Nenhum ${isGoogle ? "registro de conversão" : isMixed ? "resultado" : "registro de venda"} atribuído no período; o custo por resultado não pode ser calculado.`);
  if (revenueDelta != null && revenueDelta < -10) attentionPoints.push(`${valueLabel[0].toUpperCase()}${valueLabel.slice(1)} caiu ${Math.abs(revenueDelta).toFixed(1)}% frente ao período anterior.`);
  const stopped = drivers.filter((d) => d.comparison === "stopped").length;
  const newly = drivers.filter((d) => d.comparison === "new").length;
  if (newly) attentionPoints.push(`${newly} campanha(s) nova(s), sem base anterior para variação percentual.`);
  if (stopped) attentionPoints.push(`${stopped} campanha(s) parou(aram) de entregar no período atual.`);
  if (!attentionPoints.length) attentionPoints.push("Nenhum desvio crítico foi identificado pelos dados disponíveis.");
  return {
    directAnswer,
    evidence,
    funnelReading,
    attentionPoints,
    followUps: [
      `Quais campanhas mais contribuíram para ${isGoogle ? "o valor de conversão" : isMixed ? "o valor atribuído" : "a receita"}?`,
      "Onde está a maior perda do funil?",
      "O que mudou em relação ao período anterior?",
    ],
  };
}