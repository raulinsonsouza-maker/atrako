"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, ReferenceLine,
} from "recharts";

function fmt(v: number, d = 0): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(d)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(d)}k`;
  return `R$ ${v.toFixed(0)}`;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-orange-500 mb-4">
      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
      {label}
    </p>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-neutral-800 bg-[#18181b] p-6 ${className}`}>{children}</div>
  );
}

const Check = ({ c = "w-4 h-4" }: { c?: string }) => (
  <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const X = ({ c = "w-4 h-4" }: { c?: string }) => (
  <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const Arrow = ({ c = "w-4 h-4" }: { c?: string }) => (
  <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
);

// ─── TAB 1: Estratégia profunda (Unit Economics) ─────────────────────────────
function TabEstrategia() {
  const [faturamento, setFaturamento] = useState(50_000);
  const [margem, setMargem] = useState(20);
  const [fee, setFee] = useState(5_000);
  const [midia, setMidia] = useState(5_000);
  const investimentoTotal = fee + midia;
  const lucroBruto = faturamento * (margem / 100);
  const lucroLiquido = lucroBruto - investimentoTotal;
  const peso = lucroBruto > 0 ? (investimentoTotal / lucroBruto) * 100 : 0;

  const inviavel = lucroLiquido < 0;
  const apertado = !inviavel && peso > 70;

  return (
    <div className="space-y-8">
      {/* problema real */}
      <Card>
        <SectionLabel label="O problema real (não é só posicionamento)" />
        <h3 className="text-2xl font-extrabold text-white mb-4">Atrair lead errado custa caro de 3 formas</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { num: "01", title: "ICP desalinhado", desc: "Atraímos quem não tem capacidade financeira. Volume alto, fechamento zero." },
            { num: "02", title: "Oferta desalinhada", desc: "Vendemos algo que não cabe na estrutura financeira do prospect — ele recua e churna em 2 meses." },
            { num: "03", title: "Unit economics ignorado", desc: "Nenhum filtro baseado em capacidade de ROI real. Operação otimizada para Tipo 1 enquanto faturamento depende do Tipo 3." },
          ].map(({ num, title, desc }) => (
            <div key={num} className="rounded-xl bg-neutral-900 border border-neutral-800 p-5">
              <span className="text-orange-500 font-extrabold text-xs">{num}</span>
              <p className="text-white font-bold mt-2 mb-1">{title}</p>
              <p className="text-neutral-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Calculadora unit economics */}
      <Card className="bg-gradient-to-br from-orange-500/[0.04] to-transparent border-orange-500/20">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          <div>
            <SectionLabel label="Calculadora Unit Economics" />
            <h3 className="text-2xl font-extrabold text-white mb-2">A conta que comprova: cliente pequeno = prejuízo dele</h3>
            <p className="text-neutral-400 text-sm leading-relaxed mb-6">
              Ajuste o faturamento e a margem do prospect. Veja matematicamente quando o seu serviço
              <strong className="text-white"> consome mais que o lucro dele</strong> — esse é o filtro.
            </p>

            <div className="space-y-5">
              {[
                { label: "Faturamento mensal do prospect", value: faturamento, set: setFaturamento, min: 30_000, max: 1_000_000, step: 10_000, display: fmt(faturamento, 0) },
                { label: "Margem operacional do prospect", value: margem, set: setMargem, min: 5, max: 40, step: 1, display: `${margem}%` },
              ].map(({ label, value, set, min, max, step, display }) => (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400 font-medium">{label}</span>
                    <span className="text-orange-400 font-bold">{display}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-neutral-900 p-5 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-neutral-500 text-[10px] uppercase tracking-widest font-bold">Estrutura inout (ajuste)</p>
                <p className="text-orange-400 text-[10px] uppercase tracking-widest font-bold">Total {fmt(investimentoTotal)}</p>
              </div>

              {[
                { label: "Fee mensal", value: fee, set: setFee, min: 3_000, max: 15_000, step: 500 },
                { label: "Mídia média", value: midia, set: setMidia, min: 3_000, max: 15_000, step: 500 },
              ].map(({ label, value, set, min, max, step }) => (
                <div key={label} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400 font-medium">{label}</span>
                    <span className="text-white font-bold tabular-nums">{fmt(value)}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer h-1" />
                </div>
              ))}

              <p className="text-[10px] text-neutral-500 leading-snug pt-1 border-t border-neutral-800">
                Na prática, mídia ≈ fee. Cliente pequeno raramente comporta mídia muito acima disso —
                quando comporta, geralmente também comporta um fee maior.
              </p>
            </div>

            <div className="rounded-xl bg-neutral-900 p-5 border border-neutral-800">
              <p className="text-neutral-500 text-[10px] uppercase tracking-widest font-bold mb-3">Conta do prospect</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Lucro bruto ({margem}%)</span>
                  <span className="text-white font-semibold tabular-nums">{fmt(lucroBruto, 1)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">– Investimento com a inout</span>
                  <span className="text-red-400 font-semibold tabular-nums">−{fmt(investimentoTotal, 1)}</span>
                </div>
                <div className="border-t border-neutral-800 pt-2 flex justify-between">
                  <span className="text-neutral-300 font-bold">Lucro líquido real</span>
                  <span className={`font-extrabold text-lg tabular-nums ${lucroLiquido < 0 ? "text-red-400" : lucroLiquido < 5000 ? "text-amber-400" : "text-emerald-400"}`}>
                    {lucroLiquido < 0 ? "−" : ""}{fmt(Math.abs(lucroLiquido), 1)}
                  </span>
                </div>
              </div>
            </div>

            <div className={`rounded-xl p-5 border ${inviavel ? "bg-red-500/[0.07] border-red-500/30" : apertado ? "bg-amber-500/[0.07] border-amber-500/30" : "bg-emerald-500/[0.07] border-emerald-500/30"}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${inviavel ? "text-red-400" : apertado ? "text-amber-400" : "text-emerald-400"}`}>
                {inviavel ? "Inviável — DESCARTAR" : apertado ? "Apertado — RISCO ALTO" : "Saudável — APROVAR"}
              </p>
              <p className="text-white text-sm font-semibold">
                {inviavel
                  ? "O serviço consome 100%+ do lucro. Vai churnar em 2-3 meses."
                  : apertado
                  ? `Inout pesa ${peso.toFixed(0)}% do lucro do cliente. Margem perigosa para sustentar contrato.`
                  : `Inout pesa apenas ${peso.toFixed(0)}% do lucro. Cliente tem espaço para investir e escalar.`}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Os 3 tipos de lead */}
      <div>
        <SectionLabel label="Distribuição real dos leads que entram hoje" />
        <h3 className="text-2xl font-extrabold text-white mb-6">Os 3 tipos de lead — e por que 80% trava sua operação</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { tier: "Tipo 1 — Sobrevivência", pct: "80%", fat: "Até R$ 50k/mês", color: "red", borderCls: "border-red-500/30", bgCls: "bg-red-500/[0.05]", textCls: "text-red-400", textPctCls: "text-red-400",
              chars: ["Sem caixa real", "Quer 'milagre' rápido", "Compra preço, não valor", "Churna em 1-2 meses"],
              veredicto: "NUNCA fecham ticket alto — sucção de operação" },
            { tier: "Tipo 2 — Transição", pct: "15%", fat: "R$ 50k–150k/mês", color: "amber", borderCls: "border-amber-500/30", bgCls: "bg-amber-500/[0.05]", textCls: "text-amber-400", textPctCls: "text-amber-400",
              chars: ["Conseguem investir, com risco", "Querem ver resultado em 60d", "Negociam fee", "Dão trabalho desproporcional"],
              veredicto: "Fecham, mas dão churn e custo operacional alto" },
            { tier: "Tipo 3 — Escala", pct: "5%", fat: "R$ 150k+/mês", color: "emerald", borderCls: "border-emerald-500/30", bgCls: "bg-emerald-500/[0.05]", textCls: "text-emerald-400", textPctCls: "text-emerald-400",
              chars: ["Operação validada", "Pensam em ROI, não em custo", "Querem previsibilidade", "Aceitam ticket 10k+"],
              veredicto: "SEU CLIENTE REAL — ticket, retenção, expansão" },
          ].map(({ tier, pct, fat, borderCls, bgCls, textCls, textPctCls, chars, veredicto }) => (
            <Card key={tier} className={`${borderCls} ${bgCls}`}>
              <div className="flex items-baseline justify-between mb-4">
                <p className={`text-[10px] font-black uppercase tracking-widest ${textCls}`}>{tier}</p>
                <p className={`text-3xl font-extrabold ${textPctCls}`}>{pct}</p>
              </div>
              <p className="text-white font-bold mb-3">{fat}</p>
              <ul className="space-y-1.5 mb-4">
                {chars.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-xs text-neutral-400">
                    <span className={`mt-1 w-1 h-1 rounded-full shrink-0 ${textCls.replace("text-", "bg-")}`} />
                    {c}
                  </li>
                ))}
              </ul>
              <div className={`text-[11px] leading-snug font-semibold pt-3 border-t border-neutral-800 ${textCls}`}>
                {veredicto}
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-neutral-400 text-sm max-w-2xl mx-auto">
          A operação está otimizada para o <span className="text-red-400 font-bold">Tipo 1</span>,
          mas o faturamento depende do <span className="text-emerald-400 font-bold">Tipo 3</span>.
          Esse desalinhamento é o gargalo invisível.
        </p>
      </div>
    </div>
  );
}

// ─── TAB 2: Funil correto ────────────────────────────────────────────────────
function TabFunil() {
  const camadas = [
    {
      cor: "red", nome: "Aquisição ampla", taxa: "Volume alto, custo baixo",
      bgCls: "bg-red-500/[0.05]", borderCls: "border-red-500/20", textCls: "text-red-400",
      acoes: ["Anúncios Meta com copy filtrante", "Search Google em termos comerciais", "LP com microcopy de exclusão visível"],
      kpi: "CPL bruto", meta: "R$ 30–60",
    },
    {
      cor: "amber", nome: "Qualificação", taxa: "Onde o jogo é ganho",
      bgCls: "bg-amber-500/[0.05]", borderCls: "border-amber-500/20", textCls: "text-amber-400",
      acoes: ["Formulário com 8 perguntas estratégicas", "Score automático A/B/C/DQ", "Bloqueio em tempo real para fora do perfil"],
      kpi: "% leads qualificados", meta: "15–25%",
    },
    {
      cor: "emerald", nome: "Conversão", taxa: "Só A/B passam",
      bgCls: "bg-emerald-500/[0.05]", borderCls: "border-emerald-500/20", textCls: "text-emerald-400",
      acoes: ["Pré-call em vídeo (3 min) com âncora de preço", "Diagnóstico estratégico aprofundado", "Proposta baseada em VGV/meta, não em entrega"],
      kpi: "Taxa fechamento", meta: "30–45%",
    },
  ];

  return (
    <div className="space-y-8">
      <Card>
        <SectionLabel label="Erro estrutural atual" />
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-2xl font-extrabold text-white mb-3">Hoje vendemos direto da camada 1</h3>
            <p className="text-neutral-400 text-sm leading-relaxed mb-4">
              O time tenta converter qualquer lead que chegou pelo anúncio. Resultado: comercial gasta 80% do tempo
              com leads que <strong className="text-white">nunca fechariam contrato saudável</strong> — e os 5% bons
              não recebem atenção qualificada.
            </p>
            <div className="space-y-2">
              {[
                "Comercial sobrecarregado com lixo qualificado",
                "Top performers desmotivados",
                "Ticket médio puxado pra baixo por leads pequenos",
                "Churn alto puxa LTV pra baixo",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2 text-sm text-neutral-300">
                  <X c="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4">Funil quebrado de hoje</p>
            <div className="space-y-3">
              {[
                { label: "Leads que entram", val: 100, color: "bg-neutral-700" },
                { label: "Leads atendidos", val: 100, color: "bg-orange-500/60" },
                { label: "Reuniões agendadas", val: 30, color: "bg-orange-500/60" },
                { label: "Fechamentos", val: 4, color: "bg-orange-500" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400">{s.label}</span>
                    <span className="text-white font-bold">{s.val}</span>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-800">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.val}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-4 italic">100 leads geram apenas 4 fechamentos — e o time gastou tempo com os 96.</p>
          </div>
        </div>
      </Card>

      <div>
        <SectionLabel label="Funil correto" />
        <h3 className="text-2xl font-extrabold text-white mb-6">3 camadas com filtros reais entre elas</h3>
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {camadas.map((c, i) => (
            <Card key={c.nome} className={`${c.borderCls} ${c.bgCls} relative`}>
              <div className="flex items-baseline justify-between mb-4">
                <span className={`text-[11px] font-black uppercase tracking-widest ${c.textCls}`}>Camada {i + 1}</span>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${c.textCls} bg-neutral-900 px-2 py-1 rounded-full`}>{c.taxa}</span>
              </div>
              <h4 className="text-xl font-extrabold text-white mb-4">{c.nome}</h4>
              <ul className="space-y-2 mb-5">
                {c.acoes.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-xs text-neutral-300">
                    <Check c={`w-3 h-3 mt-0.5 shrink-0 ${c.textCls}`} />
                    {a}
                  </li>
                ))}
              </ul>
              <div className="border-t border-neutral-800 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">{c.kpi}</p>
                  <p className={`text-base font-extrabold ${c.textCls}`}>{c.meta}</p>
                </div>
                {i < 2 && <Arrow c={`w-5 h-5 ${c.textCls} hidden md:block`} />}
              </div>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-br from-emerald-500/[0.04] to-transparent border-emerald-500/20">
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500 mb-2">Resultado simulado com filtro</p>
          <h4 className="text-lg font-extrabold text-white mb-4">100 leads → 4 fechamentos vira 100 leads → 6 fechamentos com 70% menos esforço</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { label: "Leads brutos", val: "100", sub: "anúncio amplo" },
              { label: "Bloqueados no form", val: "75", sub: "75% — fora do perfil" },
              { label: "Reuniões qualificadas", val: "20", sub: "só A/B passam" },
              { label: "Fechamentos", val: "6", sub: "vs 4 hoje (+50%)" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">{s.label}</p>
                <p className="text-2xl font-extrabold text-emerald-400 mb-0.5">{s.val}</p>
                <p className="text-xs text-neutral-500">{s.sub}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── TAB 3: Formulário simulado ──────────────────────────────────────────────
type Q = {
  id: string;
  pergunta: string;
  opcoes: { label: string; weight: number; dq?: boolean }[];
  showIf?: (answers: Record<string, string>) => boolean;
};

const QUESTIONS: Q[] = [
  {
    id: "tipo",
    pergunta: "Qual o tipo da sua empresa?",
    opcoes: [
      { label: "Construtora", weight: 5 },
      { label: "Incorporadora", weight: 8 },
      { label: "Imobiliária", weight: 3 },
      { label: "Outro segmento", weight: 0 },
    ],
  },
  {
    id: "vendas",
    pergunta: "Sua empresa realiza vendas de forma ativa hoje?",
    opcoes: [
      { label: "Sim, com frequência e consistência", weight: 25 },
      { label: "Sim, mas sem consistência", weight: 10 },
      { label: "Ainda não temos vendas ativas", weight: 0, dq: true },
    ],
  },
  {
    id: "faturamento",
    pergunta: "Qual o faturamento mensal médio da operação?",
    opcoes: [
      { label: "Acima de R$ 1 milhão", weight: 35 },
      { label: "R$ 300 mil – R$ 1 milhão", weight: 25 },
      { label: "R$ 150 mil – R$ 300 mil", weight: 15 },
      { label: "Até R$ 150 mil", weight: 0, dq: true },
    ],
  },
  {
    id: "vgv",
    pergunta: "Qual o VGV médio dos seus empreendimentos? (Valor Geral de Vendas — soma do potencial de venda total)",
    opcoes: [
      { label: "Acima de R$ 100M", weight: 30 },
      { label: "R$ 50M – R$ 100M", weight: 25 },
      { label: "R$ 20M – R$ 50M", weight: 15 },
      { label: "Abaixo de R$ 20M", weight: 8 },
    ],
    showIf: (a) => a.tipo === "Construtora" || a.tipo === "Incorporadora",
  },
  {
    id: "objetivo",
    pergunta: "Qual seu foco principal hoje?",
    opcoes: [
      { label: "Escalar vendas com previsibilidade", weight: 20 },
      { label: "Gerar mais oportunidades qualificadas", weight: 15 },
      { label: "Melhorar eficiência do que já funciona", weight: 12 },
      { label: "Estruturar processo de vendas do zero", weight: 5 },
    ],
  },
  {
    id: "marketing",
    pergunta: "Hoje você investe em marketing pago?",
    opcoes: [
      { label: "Sim, com resultado previsível", weight: 20 },
      { label: "Sim, mas sem consistência", weight: 12 },
      { label: "Não invisto atualmente", weight: 0 },
    ],
  },
  {
    id: "estrutura",
    pergunta: "Você possui equipe para atender novos leads?",
    opcoes: [
      { label: "Sim, equipe estruturada (3+ pessoas)", weight: 15 },
      { label: "Sim, equipe pequena (1–2 pessoas)", weight: 8 },
      { label: "Não tenho estrutura comercial dedicada", weight: 0 },
    ],
  },
  {
    id: "investimento",
    pergunta: "Qual seu investimento mensal disponível para marketing?",
    opcoes: [
      { label: "Acima de R$ 20 mil", weight: 30 },
      { label: "R$ 10 mil – R$ 20 mil", weight: 20 },
      { label: "R$ 5 mil – R$ 10 mil", weight: 8 },
      { label: "Abaixo de R$ 5 mil / não tenho budget", weight: 0, dq: true },
    ],
  },
  {
    id: "decisor",
    pergunta: "Você é o decisor da contratação?",
    opcoes: [
      { label: "Sim, decido sozinho", weight: 12 },
      { label: "Decido com sócio(s)", weight: 10 },
      { label: "Apresento para outra pessoa decidir", weight: 3 },
    ],
  },
  {
    id: "urgencia",
    pergunta: "Quando pretende iniciar um projeto de crescimento?",
    opcoes: [
      { label: "Imediatamente", weight: 15 },
      { label: "Próximos 30 dias", weight: 10 },
      { label: "Próximos 60–90 dias", weight: 5 },
      { label: "Ainda avaliando, sem prazo", weight: 0 },
    ],
  },
];

const MAX_SCORE = QUESTIONS.reduce(
  (acc, q) => acc + Math.max(...q.opcoes.map((o) => o.weight)),
  0
);

function FormularioSimulado() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);

  const visible = useMemo(
    () => QUESTIONS.filter((q) => !q.showIf || q.showIf(answers)),
    [answers]
  );
  const current = visible[step];
  const isLast = step === visible.length - 1;
  const completed = Object.keys(answers).length === visible.length && step >= visible.length - 1 && answers[current?.id];

  const { score, dq, dqReason } = useMemo(() => {
    let s = 0;
    let d = false;
    let reason = "";
    for (const q of visible) {
      const v = answers[q.id];
      if (!v) continue;
      const opt = q.opcoes.find((o) => o.label === v);
      if (!opt) continue;
      s += opt.weight;
      if (opt.dq) {
        d = true;
        reason = q.pergunta;
      }
    }
    return { score: s, dq: d, dqReason: reason };
  }, [answers, visible]);

  const tier = useMemo(() => {
    if (dq) return { code: "DQ", label: "Fora do perfil", color: "red" as const, action: "Conteúdo gratuito + nutrição (não atender)" };
    const pct = (score / MAX_SCORE) * 100;
    if (pct >= 75) return { code: "A", label: "Premium — atendimento imediato", color: "emerald" as const, action: "Diagnóstico estratégico em ≤ 24h. Proposta enterprise." };
    if (pct >= 55) return { code: "B", label: "Qualificado — agendamento padrão", color: "sky" as const, action: "Pré-call em vídeo + diagnóstico em até 5 dias." };
    if (pct >= 30) return { code: "C", label: "Nutrição — oferta de entrada", color: "amber" as const, action: "Workshop pago / mini diagnóstico (R$ 1k–2k) para subir consciência." };
    return { code: "DQ", label: "Fora do perfil", color: "red" as const, action: "Conteúdo gratuito + nutrição (não atender)." };
  }, [score, dq]);

  function answer(label: string) {
    setAnswers((a) => ({ ...a, [current.id]: label }));
    if (!isLast) {
      setTimeout(() => setStep((s) => Math.min(visible.length - 1, s + 1)), 200);
    }
  }
  function reset() {
    setAnswers({});
    setStep(0);
    setAccepted(false);
  }

  // tela de abertura
  if (!accepted) {
    return (
      <Card className="space-y-6">
        <div>
          <SectionLabel label="Simulação interativa do formulário" />
          <h3 className="text-2xl font-extrabold text-white mb-2">Diagnóstico de Crescimento para Construtoras</h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Esse formulário é voltado para construtoras e incorporadoras com operação ativa que buscam
            crescimento com previsibilidade. Em ~90 segundos você recebe um diagnóstico estratégico
            personalizado da sua operação.
          </p>
        </div>

        <div className="rounded-xl bg-amber-500/[0.05] border border-amber-500/20 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">Atenção</p>
          <p className="text-sm text-neutral-300">
            Hoje atendemos apenas empresas com <strong className="text-white">faturamento acima de R$ 150 mil/mês</strong>,
            operação ativa e investimento em marketing. Se ainda não está nesse estágio, o formulário será
            interrompido com sugestões de conteúdo gratuito.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => setAccepted(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-orange-500/25 transition-all inline-flex items-center gap-2">
            Sim, quero avançar <Arrow c="w-4 h-4" />
          </button>
          <button className="border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-600 px-6 py-3 rounded-xl font-bold text-sm transition-all">
            Cliquei por engano
          </button>
        </div>
      </Card>
    );
  }

  // tela final qualificado
  if (completed || dq) {
    const tierStyles = {
      emerald: { card: "border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.05] to-transparent", iconBg: "bg-emerald-500/15", text: "text-emerald-400" },
      sky: { card: "border-sky-500/30 bg-gradient-to-br from-sky-500/[0.05] to-transparent", iconBg: "bg-sky-500/15", text: "text-sky-400" },
      amber: { card: "border-amber-500/30 bg-gradient-to-br from-amber-500/[0.05] to-transparent", iconBg: "bg-amber-500/15", text: "text-amber-400" },
      red: { card: "border-red-500/30 bg-gradient-to-br from-red-500/[0.05] to-transparent", iconBg: "bg-red-500/15", text: "text-red-400" },
    } as const;
    const ts = tierStyles[tier.color];
    return (
      <Card className={`space-y-6 ${ts.card}`}>
        <div className="text-center">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${ts.iconBg}`}>
            {dq
              ? <X c={`w-8 h-8 ${ts.text}`} />
              : <Check c={`w-8 h-8 ${ts.text}`} />}
          </div>
          <p className={`text-[11px] font-black uppercase tracking-widest ${ts.text} mb-2`}>
            Tier {tier.code} · Score {score}/{MAX_SCORE}
          </p>
          <h3 className={`text-2xl md:text-3xl font-extrabold text-white mb-3`}>{tier.label}</h3>
          <p className="text-neutral-400 max-w-xl mx-auto">{tier.action}</p>
        </div>

        {dq && (
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Motivo do bloqueio</p>
            <p className="text-sm text-neutral-300">{dqReason}</p>
            <p className="text-xs text-neutral-500 mt-2">
              Você não vai entrar no CRM nem ocupar tempo do comercial. Em vez disso, vai receber uma sequência de
              conteúdo gratuito até atingir o perfil — depois disso, o formulário libera novamente.
            </p>
          </div>
        )}

        <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3">Resumo das respostas</p>
          <div className="space-y-2">
            {visible.filter((q) => answers[q.id]).map((q) => {
              const opt = q.opcoes.find((o) => o.label === answers[q.id]);
              return (
                <div key={q.id} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-neutral-500 flex-1 truncate">{q.pergunta}</span>
                  <span className="text-white font-semibold text-right max-w-[55%] truncate">{answers[q.id]}</span>
                  <span className={`shrink-0 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                    (opt?.weight ?? 0) >= 20 ? "bg-emerald-500/10 text-emerald-400" :
                    (opt?.weight ?? 0) >= 10 ? "bg-sky-500/10 text-sky-400" :
                    (opt?.weight ?? 0) > 0 ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {opt?.weight != null ? `+${opt.weight}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center">
          <button onClick={reset} className="text-sm font-semibold text-neutral-400 hover:text-white transition-colors underline underline-offset-4">
            Refazer simulação
          </button>
        </div>
      </Card>
    );
  }

  const progress = ((step + 1) / visible.length) * 100;

  return (
    <Card className="space-y-6">
      {/* progress */}
      <div>
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-neutral-500 font-semibold">Pergunta {step + 1} de {visible.length}</span>
          <span className="text-neutral-500 tabular-nums">Score parcial: <strong className="text-orange-400">{score}</strong></span>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-800">
          <div className="h-full rounded-full bg-orange-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div>
        <h3 className="text-xl md:text-2xl font-extrabold text-white mb-5 leading-tight">{current.pergunta}</h3>
        <div className="space-y-2">
          {current.opcoes.map((o) => {
            const selected = answers[current.id] === o.label;
            return (
              <button
                key={o.label}
                onClick={() => answer(o.label)}
                className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all flex items-center justify-between gap-3 group
                  ${selected
                    ? "border-orange-500 bg-orange-500/[0.08]"
                    : "border-neutral-800 bg-neutral-900 hover:border-neutral-700 hover:bg-neutral-800/50"}`}
              >
                <span className={`text-sm font-semibold ${selected ? "text-white" : "text-neutral-300 group-hover:text-white"}`}>
                  {o.label}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {o.dq && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">
                      DQ
                    </span>
                  )}
                  <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                    o.weight >= 20 ? "bg-emerald-500/10 text-emerald-400" :
                    o.weight >= 10 ? "bg-sky-500/10 text-sky-400" :
                    o.weight > 0 ? "bg-amber-500/10 text-amber-400" :
                    "bg-neutral-800 text-neutral-500"
                  }`}>
                    {o.dq ? "0" : `+${o.weight}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-sm font-semibold text-neutral-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Voltar
        </button>
        <button
          onClick={reset}
          className="text-xs font-semibold text-neutral-500 hover:text-white transition-colors"
        >
          Recomeçar
        </button>
      </div>
    </Card>
  );
}

// ─── TAB 4: Oferta dupla ─────────────────────────────────────────────────────
function TabOferta() {
  return (
    <div className="space-y-8">
      <Card>
        <SectionLabel label="O pulo do gato" />
        <h3 className="text-2xl font-extrabold text-white mb-3">Não jogue os 80% no lixo — monetize</h3>
        <p className="text-neutral-400 text-sm leading-relaxed max-w-3xl">
          O erro mais caro depois do ICP errado é <strong className="text-white">descartar 80% dos leads sem extrair valor deles</strong>.
          Esses leads pagaram o seu CPL — quem paga já está dentro. Crie uma oferta de entrada que
          (1) custeia parte do tráfego, (2) não sobrecarrega operação, e (3) seleciona quem evolui para premium.
        </p>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Premium */}
        <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.05] to-transparent relative">
          <div className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
            Tier A · Receita principal
          </div>
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-2">Oferta Premium</p>
          <h4 className="text-xl font-extrabold text-white mb-1">Aceleração de Vendas Inout</h4>
          <p className="text-3xl font-extrabold text-emerald-400 mb-1">R$ 10k–25k<span className="text-base text-neutral-400 font-medium">/mês</span></p>
          <p className="text-xs text-neutral-500 mb-5">Fee + mídia + estrutura completa</p>

          <div className="space-y-2 mb-5">
            {[
              "Estratégia + tráfego + criativos + dashboards",
              "Reuniões semanais com diretoria",
              "SLA de performance contratual",
              "Integração CRM + treinamento comercial",
              "Diagnóstico estratégico mensal",
            ].map((b) => (
              <div key={b} className="flex items-start gap-2 text-sm text-neutral-300">
                <Check c="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {b}
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-neutral-900 border border-neutral-800 p-3">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Para quem</p>
            <p className="text-sm text-white font-semibold">Tier A: faturamento R$ 1M+/mês, VGV R$ 50M+, decisor pronto</p>
          </div>
        </Card>

        {/* Entrada */}
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/[0.05] to-transparent relative">
          <div className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
            Tier B/C · Filtro pago
          </div>
          <p className="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-2">Oferta de Entrada</p>
          <h4 className="text-xl font-extrabold text-white mb-1">Diagnóstico Estratégico Inout</h4>
          <p className="text-3xl font-extrabold text-amber-400 mb-1">R$ 1.5k–2.5k<span className="text-base text-neutral-400 font-medium"> · pontual</span></p>
          <p className="text-xs text-neutral-500 mb-5">2 semanas · entregável fechado</p>

          <div className="space-y-2 mb-5">
            {[
              "Auditoria de tráfego, funil e CRM atual",
              "Mapa de oportunidade com 10 ações priorizadas",
              "Sessão de 90 min com diretoria",
              "Documento executivo (PDF) entregável",
              "Crédito de 100% se evoluir para premium em 60 dias",
            ].map((b) => (
              <div key={b} className="flex items-start gap-2 text-sm text-neutral-300">
                <Check c="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                {b}
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-neutral-900 border border-neutral-800 p-3">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Para quem</p>
            <p className="text-sm text-white font-semibold">Tier B/C: fatura R$ 150k–1M, quer testar antes de assumir contrato grande</p>
          </div>
        </Card>
      </div>

      {/* Math da oferta dupla */}
      <Card className="bg-gradient-to-br from-orange-500/[0.04] to-transparent border-orange-500/20">
        <SectionLabel label="Por que isso é matemática, não filosofia" />
        <h3 className="text-2xl font-extrabold text-white mb-5">Impacto em 100 leads/mês</h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-3">Modelo atual</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-neutral-400">100 leads × CPL R$ 50</span><span className="text-white tabular-nums">R$ 5.000</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">4 fechamentos × R$ 12k</span><span className="text-white tabular-nums">R$ 48.000</span></div>
              <div className="flex justify-between border-t border-neutral-800 pt-2"><span className="text-neutral-300 font-bold">Receita líquida</span><span className="text-red-400 font-extrabold tabular-nums">R$ 43k</span></div>
              <div className="flex justify-between"><span className="text-neutral-500 text-xs">96 leads descartados</span><span className="text-neutral-500 text-xs">R$ 0 extraído</span></div>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/30 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">Modelo com oferta dupla</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-neutral-400">100 leads × CPL R$ 50</span><span className="text-white tabular-nums">R$ 5.000</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">6 premium × R$ 15k (filtro melhor)</span><span className="text-white tabular-nums">R$ 90.000</span></div>
              <div className="flex justify-between"><span className="text-neutral-400">8 diagnósticos × R$ 2k</span><span className="text-white tabular-nums">R$ 16.000</span></div>
              <div className="flex justify-between border-t border-neutral-800 pt-2"><span className="text-neutral-300 font-bold">Receita líquida</span><span className="text-emerald-400 font-extrabold tabular-nums">R$ 101k</span></div>
              <div className="flex justify-between"><span className="text-emerald-500 text-xs font-bold">+135% vs modelo atual</span><span className="text-emerald-500 text-xs font-bold">CPL pago 20×</span></div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── COMPONENT PRINCIPAL com tabs ─────────────────────────────────────────────
const TABS = [
  { id: "estrategia", label: "Estratégia profunda" },
  { id: "funil", label: "Funil correto" },
  { id: "formulario", label: "Formulário simulado" },
  { id: "oferta", label: "Oferta dupla" },
] as const;

type TabId = typeof TABS[number]["id"];

export function AquisicaoQualificada() {
  const [tab, setTab] = useState<TabId>("estrategia");

  return (
    <div className="space-y-10">
      {/* tabs */}
      <div className="rounded-2xl border border-neutral-800 bg-[#18181b] p-1.5 inline-flex flex-wrap gap-1.5 max-w-full overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              tab === t.id
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "estrategia" && <TabEstrategia />}
      {tab === "funil" && <TabFunil />}
      {tab === "formulario" && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <FormularioSimulado />
          </div>
          <div className="space-y-4">
            <Card>
              <SectionLabel label="Como interpretar" />
              <h4 className="text-base font-extrabold text-white mb-3">Tier de qualificação</h4>
              <div className="space-y-2.5 text-xs">
                {[
                  { tier: "A", textCls: "text-emerald-400", label: "Premium · ≥ 75% score", action: "Diagnóstico em ≤ 24h" },
                  { tier: "B", textCls: "text-sky-400", label: "Qualificado · 55–74%", action: "Pré-call + diagnóstico em 5 dias" },
                  { tier: "C", textCls: "text-amber-400", label: "Nutrição · 30–54%", action: "Oferta de entrada paga" },
                  { tier: "DQ", textCls: "text-red-400", label: "Bloqueado · < 30% ou DQ", action: "Conteúdo gratuito" },
                ].map((t) => (
                  <div key={t.tier} className="flex items-start gap-3 rounded-lg bg-neutral-900 border border-neutral-800 p-3">
                    <span className={`${t.textCls} font-extrabold text-base shrink-0`}>{t.tier}</span>
                    <div>
                      <p className="text-white font-semibold">{t.label}</p>
                      <p className="text-neutral-500">{t.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionLabel label="Regras de DQ automática" />
              <ul className="space-y-2 text-xs text-neutral-400">
                {[
                  "Faturamento até R$ 150k/mês",
                  "Não possui vendas ativas",
                  "Sem budget de marketing (< R$ 5k)",
                ].map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <X c="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-neutral-500 mt-3 italic">
                Qualquer uma dessas respostas bloqueia o agendamento, mesmo que o score geral seja alto.
              </p>
            </Card>
          </div>
        </div>
      )}
      {tab === "oferta" && <TabOferta />}
    </div>
  );
}
