import { artifactId, type ChartArtifact } from "./artifacts";

/**
 * Gráficos montados no servidor a partir do resultado das ferramentas de leitura.
 * Os números vêm do banco — o modelo nunca escreve dados de gráfico.
 * No máximo um gráfico por chamada de ferramenta (o mais útil para aquela pergunta).
 */

type Row = Record<string, unknown>;
const obj = (v: unknown): Row | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null);
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((x) => obj(x)) as Row[]) : []);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" && v ? v : fallback);

function chart(c: Omit<ChartArtifact, "kind" | "id">): ChartArtifact {
  return { kind: "chart", id: artifactId("chart"), ...c };
}

function dayLabel(iso: string) {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  return MONTHS[idx] ? `${MONTHS[idx]}/${y.slice(2)}` : ym;
}

const LIFECYCLE: Record<string, string> = {
  NEW: "Novos",
  ACTIVE: "Ativos",
  AT_RISK: "Em risco",
  LOST: "Perdidos",
  CHURNED: "Perdidos",
  VIP: "VIP",
  LOYAL: "Fiéis",
  PROSPECT: "Prospects",
};

const BOOKING_STATUS: Record<string, string> = {
  CONFIRMED: "Confirmados",
  PENDING: "Pendentes",
  CANCELLED: "Cancelados",
  COMPLETED: "Realizados",
  NO_SHOW: "Faltas",
  RESCHEDULED: "Remarcados",
};

function midia(data: Row): ChartArtifact | null {
  const current = obj(data.current);
  if (!current) return null;
  const granularity = str(data.granularity, "period");
  const channel = str(data.channel, "geral");
  if (granularity === "day") {
    const daily = arr(current.daily);
    if (daily.length < 2) return null;
    return chart({
      chart: "line",
      title: "Investimento em mídia por dia",
      unit: "currency",
      xKey: "dia",
      series: [{ key: "investimento", label: "Investimento", tone: "current" }],
      data: daily.map((d) => ({ dia: dayLabel(str(d.day)), investimento: num(d.investimento) })),
      note: "Últimos 14 dias com dados.",
    });
  }
  if (granularity === "month") {
    const monthly = arr(current.monthly);
    if (!monthly.length) return null;
    if (channel === "geral") {
      return chart({
        chart: "bar",
        title: "Investimento por mês e plataforma",
        unit: "currency",
        xKey: "mes",
        series: [
          { key: "meta", label: "Meta Ads", tone: "current" },
          { key: "google", label: "Google Ads", tone: "spend" },
        ],
        data: monthly.map((m) => ({
          mes: monthLabel(str(m.month)),
          meta: obj(m.meta) ? num(obj(m.meta)!.investimento) : null,
          google: obj(m.google) ? num(obj(m.google)!.investimento) : null,
        })),
      });
    }
    return chart({
      chart: "bar",
      title: `Investimento por mês — ${channel === "google" ? "Google Ads" : "Meta Ads"}`,
      unit: "currency",
      xKey: "mes",
      series: [{ key: "investimento", label: "Investimento", tone: "current" }],
      data: monthly.map((m) => ({ mes: monthLabel(str(m.month)), investimento: num(m.investimento) })),
    });
  }
  const previous = obj(data.previous);
  const cur = obj(current.platforms);
  const prev = obj(previous?.platforms);
  const rows: Array<Record<string, string | number | null>> = [];
  for (const [key, label] of [
    ["meta", "Meta Ads"],
    ["google", "Google Ads"],
  ] as const) {
    const c = obj(cur?.[key]);
    if (!c || !num(c.investimento)) continue;
    rows.push({ plataforma: label, atual: num(c.investimento), anterior: obj(prev?.[key]) ? num(obj(prev?.[key])!.investimento) : null });
  }
  if (!rows.length) return null;
  return chart({
    chart: "bar",
    title: "Investimento: período atual x anterior",
    unit: "currency",
    xKey: "plataforma",
    series: [
      { key: "atual", label: "Atual", tone: "current" },
      { key: "anterior", label: "Anterior", tone: "previous" },
    ],
    data: rows,
  });
}

function vendas(data: Row): ChartArtifact | null {
  const atual = obj(data.atual);
  const anterior = obj(data.anterior);
  if (!atual) return null;
  const origens = arr(atual.porOrigem).filter((o) => num(o.receita) > 0);
  if (origens.length >= 2) {
    return chart({
      chart: "donut",
      title: "Receita por origem",
      unit: "currency",
      xKey: "origem",
      series: [{ key: "receita", label: "Receita" }],
      data: origens.slice(0, 6).map((o) => ({ origem: str(o.label, "Outros"), receita: num(o.receita) })),
    });
  }
  if (!num(atual.receita) && !num(anterior?.receita)) return null;
  return chart({
    chart: "bar",
    title: "Receita: período atual x anterior",
    unit: "currency",
    xKey: "periodo",
    series: [{ key: "receita", label: "Receita", tone: "current" }],
    data: [
      { periodo: "Anterior", receita: num(anterior?.receita) },
      { periodo: "Atual", receita: num(atual.receita) },
    ],
  });
}

function visaoGeral(data: Row): ChartArtifact | null {
  const v = obj(data.vendas);
  if (!v || (!num(v.receita) && !num(v.receitaPeriodoAnterior))) return null;
  return chart({
    chart: "bar",
    title: "Receita: período atual x anterior",
    unit: "currency",
    xKey: "periodo",
    series: [{ key: "receita", label: "Receita", tone: "current" }],
    data: [
      { periodo: "Anterior", receita: num(v.receitaPeriodoAnterior) },
      { periodo: "Atual", receita: num(v.receita) },
    ],
  });
}

function crm(data: Row): ChartArtifact | null {
  const etapas = arr(data.etapas).filter((e) => !/lost|perd/i.test(str(e.papel)));
  if (etapas.length < 2 || !etapas.some((e) => num(e.leads) > 0)) return null;
  return chart({
    chart: "funnel",
    title: "Funil de leads por etapa",
    unit: "number",
    xKey: "etapa",
    series: [{ key: "leads", label: "Leads" }],
    data: etapas.map((e) => ({ etapa: str(e.etapa, "Etapa"), leads: num(e.leads) })),
    note: "Porcentagem ao lado = passagem em relação à etapa anterior.",
  });
}

function carrinhos(data: Row): ChartArtifact | null {
  const periodo = obj(data.periodo);
  if (!periodo) return null;
  const porMsg = obj(periodo.porMensagem);
  const sem = obj(periodo.semMensagem);
  if (num(porMsg?.valor) + num(sem?.valor) > 0) {
    return chart({
      chart: "donut",
      title: "Valor recuperado: com mensagem x sozinho",
      unit: "currency",
      xKey: "via",
      series: [{ key: "valor", label: "Valor" }],
      data: [
        { via: "Por mensagem", valor: num(porMsg?.valor) },
        { via: "Sozinho", valor: num(sem?.valor) },
      ],
    });
  }
  const idade = arr(periodo.porIdade).filter((b) => num(b.quantidade) > 0);
  if (!idade.length) return null;
  return chart({
    chart: "bar",
    title: "Carrinhos por idade",
    unit: "number",
    xKey: "faixa",
    series: [{ key: "quantidade", label: "Carrinhos", tone: "current" }],
    data: idade.map((b) => ({ faixa: str(b.faixa), quantidade: num(b.quantidade) })),
  });
}

function recompra(data: Row): ChartArtifact | null {
  const r = obj(data.recompra);
  const primeiro = obj(r?.primeirosPedidos);
  const repete = obj(r?.pedidosDeRecompra);
  if (num(primeiro?.receita) + num(repete?.receita) > 0) {
    return chart({
      chart: "donut",
      title: "Receita: primeira compra x recompra",
      unit: "currency",
      xKey: "tipo",
      series: [{ key: "receita", label: "Receita" }],
      data: [
        { tipo: "Primeira compra", receita: num(primeiro?.receita) },
        { tipo: "Recompra", receita: num(repete?.receita) },
      ],
    });
  }
  const ciclo = arr(data.cicloDeVida).filter((c) => num(c.clientes) > 0);
  if (!ciclo.length) return null;
  return chart({
    chart: "bar",
    title: "Clientes por estágio",
    unit: "number",
    xKey: "estagio",
    series: [{ key: "clientes", label: "Clientes", tone: "current" }],
    data: ciclo.map((c) => ({ estagio: LIFECYCLE[str(c.estagio)] ?? str(c.estagio), clientes: num(c.clientes) })),
  });
}

function relacionamento(data: Row): ChartArtifact | null {
  const canais = arr(data.canais).filter((c) => num(c.enviados) > 0);
  if (!canais.length) return null;
  return chart({
    chart: "bar",
    title: "Envios, aberturas e cliques por canal",
    unit: "number",
    xKey: "canal",
    series: [
      { key: "enviados", label: "Enviados", tone: "spend" },
      { key: "abertos", label: "Abertos", tone: "current" },
      { key: "cliques", label: "Cliques", tone: "revenue" },
    ],
    data: canais.map((c) => ({
      canal: str(c.canal) === "EMAIL" ? "E-mail" : str(c.canal) === "WHATSAPP" ? "WhatsApp" : str(c.canal),
      enviados: num(c.enviados),
      abertos: num(c.abertos),
      cliques: num(c.cliques),
    })),
  });
}

function agenda(data: Row): ChartArtifact | null {
  const status = arr(data.porStatus).filter((s) => num(s.quantidade) > 0);
  if (!status.length) return null;
  return chart({
    chart: "donut",
    title: "Agendamentos por status",
    unit: "number",
    xKey: "status",
    series: [{ key: "quantidade", label: "Agendamentos" }],
    data: status.map((s) => ({ status: BOOKING_STATUS[str(s.status)] ?? str(s.status), quantidade: num(s.quantidade) })),
  });
}

function comportamento(data: Row): ChartArtifact | null {
  const genero = obj(data.genero);
  const fatias = [
    { tipo: "Mulheres", receita: num(obj(genero?.mulheres)?.receita) },
    { tipo: "Homens", receita: num(obj(genero?.homens)?.receita) },
    { tipo: "Não identificado", receita: num(obj(genero?.naoIdentificado)?.receita) },
  ].filter((row) => row.receita > 0);
  if (fatias.some((row) => row.tipo !== "Não identificado")) {
    return chart({
      chart: "donut",
      title: "Receita por gênero",
      unit: "currency",
      xKey: "tipo",
      series: [{ key: "receita", label: "Receita" }],
      data: fatias,
    });
  }
  const produtos = arr(data.produtos).filter((row) => num(row.receita) > 0).slice(0, 6);
  if (!produtos.length) return null;
  return chart({
    chart: "bar",
    title: "Produtos por receita",
    unit: "currency",
    xKey: "nome",
    series: [{ key: "receita", label: "Receita", tone: "revenue" }],
    data: produtos.map((row) => ({ nome: str(row.nome), receita: num(row.receita) })),
  });
}

function marketplaces(data: Row): ChartArtifact | null {
  const estados = arr(data.porEstado).filter((row) => num(row.receita) > 0);
  if (estados.length >= 2) {
    return chart({
      chart: "bar",
      title: "Receita por estado",
      unit: "currency",
      xKey: "estado",
      series: [{ key: "receita", label: "Receita", tone: "revenue" }],
      data: estados.slice(0, 8).map((row) => ({ estado: str(row.estado, "Sem local"), receita: num(row.receita) })),
    });
  }
  const fretes = arr(data.porFrete).filter((row) => num(row.receita) > 0);
  if (fretes.length >= 2) {
    return chart({
      chart: "bar",
      title: "Receita por frete",
      unit: "currency",
      xKey: "tipo",
      series: [{ key: "receita", label: "Receita", tone: "revenue" }],
      data: fretes.map((row) => ({ tipo: str(row.tipo, "Envio"), receita: num(row.receita) })),
    });
  }
  const produtos = arr(data.produtos).filter((row) => num(row.receita) > 0).slice(0, 6);
  if (!produtos.length) return null;
  return chart({
    chart: "bar",
    title: "Produtos do marketplace",
    unit: "currency",
    xKey: "nome",
    series: [{ key: "receita", label: "Receita", tone: "revenue" }],
    data: produtos.map((row) => ({ nome: str(row.nome), receita: num(row.receita) })),
  });
}

const BUILDERS: Record<string, (data: Row) => ChartArtifact | null> = {
  midia_visao_geral: midia,
  vendas_visao_geral: vendas,
  marketplaces_visao: marketplaces,
  visao_geral_negocio: visaoGeral,
  crm_pipeline: crm,
  carrinhos_abandonados: carrinhos,
  clientes_recompra: recompra,
  comportamento_compra: comportamento,
  relacionamento_desempenho: relacionamento,
  agenda_resumo: agenda,
};

export function chartsFor(tool: string, data: unknown): ChartArtifact[] {
  const build = BUILDERS[tool];
  const row = obj(data);
  if (!build || !row) return [];
  try {
    const c = build(row);
    return c && c.data.length ? [c] : [];
  } catch {
    return [];
  }
}
