/** Cálculos puros do Início da área do cliente: funil de conversão, origens e resumo do período. */

export type InicioLead = {
  status: string;
  stageRole: string | null;
  source: string | null;
  campaign: string | null;
  answered: boolean;
  priority: "A" | "B" | "C" | null;
  meeting: boolean;
};

export type FunnelStep = { key: string; label: string; count: number; rate: number | null };

export type OriginRow = {
  key: string;
  label: string;
  leads: number;
  hot: number;
  qualified: number;
  won: number;
  spend: number | null;
  cpl: number | null;
};

export type PeriodResult = {
  leads: number;
  qualified: number;
  hot: number;
  won: number;
  revenue: number;
  spend: number;
  cpl: number | null;
  costPerSale: number | null;
};

const FUNNEL = [
  { key: "entered", label: "Entraram" },
  { key: "answered", label: "Responderam a qualificação" },
  { key: "qualified", label: "Qualificados (quentes e interessados)" },
  { key: "talking", label: "Em conversa com a equipe" },
  { key: "won", label: "Viraram venda" },
] as const;

const PROGRESS_ROLES_EXCLUDED = new Set(["ENTRY", "LOST", "ABANDONED", "ABANDONED_30", "ABANDONED_60", "ABANDONED_90"]);

/** Etapa mais avançada que o lead já alcançou (alcançar uma etapa implica as anteriores). */
export function leadFunnelLevel(lead: InicioLead) {
  if (lead.status === "WON" || lead.stageRole === "WON") return 4;
  if (lead.meeting || (lead.stageRole != null && !PROGRESS_ROLES_EXCLUDED.has(lead.stageRole))) return 3;
  if (lead.priority === "A" || lead.priority === "B") return 2;
  if (lead.answered || lead.priority === "C") return 1;
  return 0;
}

export function buildFunnel(leads: InicioLead[]): FunnelStep[] {
  const levels = leads.map(leadFunnelLevel);
  return FUNNEL.map((step, i) => {
    const count = levels.filter((l) => l >= i).length;
    const prev = i === 0 ? null : levels.filter((l) => l >= i - 1).length;
    return { key: step.key, label: step.label, count, rate: prev == null ? null : prev ? Math.round((count / prev) * 100) : 0 };
  });
}

/** Maior queda entre etapas consecutivas (onde os leads travam). */
export function biggestDrop(funnel: FunnelStep[]) {
  let worst: { from: string; to: string; lost: number; rate: number } | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const lost = funnel[i - 1].count - funnel[i].count;
    if (lost <= 0) continue;
    if (!worst || lost > worst.lost) {
      worst = { from: funnel[i - 1].label, to: funnel[i].label, lost, rate: funnel[i].rate ?? 0 };
    }
  }
  return worst;
}

export function originLabel(source: string | null, utmSource: string | null) {
  if (utmSource?.trim()) return utmSource.trim().toLowerCase();
  const s = (source || "").toLowerCase();
  if (s.endsWith("-lp")) return "Landing page";
  if (s.endsWith("-qualify")) return "Formulário passo a passo";
  if (s === "meta_lead") return "Formulário do Meta";
  if (s.includes("whatsapp")) return "WhatsApp";
  return source?.trim() || "Sem origem";
}

/** Campanha quando o lead tem (cruza com o investimento por nome); senão a origem. */
export function buildOrigins(
  leads: Array<InicioLead & { originLabel: string }>,
  spendByCampaign: Map<string, number>,
  limit = 8,
): OriginRow[] {
  const rows = new Map<string, OriginRow>();
  for (const lead of leads) {
    const label = lead.campaign?.trim() || lead.originLabel;
    const key = label.toLowerCase();
    let row = rows.get(key);
    if (!row) {
      row = { key, label, leads: 0, hot: 0, qualified: 0, won: 0, spend: null, cpl: null };
      rows.set(key, row);
    }
    row.leads += 1;
    if (lead.priority === "A") row.hot += 1;
    if (leadFunnelLevel(lead) >= 2) row.qualified += 1;
    if (leadFunnelLevel(lead) === 4) row.won += 1;
  }
  for (const [name, spend] of spendByCampaign) {
    const key = name.trim().toLowerCase();
    const row = rows.get(key);
    if (row) row.spend = (row.spend ?? 0) + spend;
    else if (spend > 0) rows.set(key, { key, label: name.trim(), leads: 0, hot: 0, qualified: 0, won: 0, spend, cpl: null });
  }
  return [...rows.values()]
    .map((r) => ({ ...r, cpl: r.spend != null && r.leads > 0 ? Math.round((r.spend / r.leads) * 100) / 100 : null }))
    .sort((a, b) => b.leads - a.leads || (b.spend ?? 0) - (a.spend ?? 0))
    .slice(0, limit);
}

export function periodResult(input: {
  leads: InicioLead[];
  revenue: number;
  spend: number;
  won: number;
}): PeriodResult {
  const hot = input.leads.filter((l) => l.priority === "A").length;
  const qualified = input.leads.filter((l) => leadFunnelLevel(l) >= 2).length;
  return {
    leads: input.leads.length,
    qualified,
    hot,
    won: input.won,
    revenue: Math.round(input.revenue * 100) / 100,
    spend: Math.round(input.spend * 100) / 100,
    cpl: input.spend > 0 && input.leads.length ? Math.round((input.spend / input.leads.length) * 100) / 100 : null,
    costPerSale: input.spend > 0 && input.won ? Math.round((input.spend / input.won) * 100) / 100 : null,
  };
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;

/** Frase única que resume o período para quem abre o painel. */
export function periodSentence(r: PeriodResult) {
  if (!r.leads && !r.won && !r.spend) return "Nenhum lead novo no período.";
  const parts = [plural(r.leads, "lead novo", "leads novos")];
  if (r.leads) parts.push(plural(r.qualified, "qualificado", "qualificados"));
  if (r.won) parts.push(`${plural(r.won, "venda", "vendas")}${r.revenue ? ` (${brl(r.revenue)})` : ""}`);
  else parts.push("nenhuma venda ainda");
  let sentence = parts.join(", ");
  if (r.spend) sentence += `. Investimento de ${brl(r.spend)}${r.cpl != null ? `, ${brl(r.cpl)} por lead` : ""}`;
  return `${sentence}.`;
}
