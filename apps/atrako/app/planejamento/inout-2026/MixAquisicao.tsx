"use client";

import React from "react";

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

// ─── Canais: 3 cards comparativos ──────────────────────────────────────────
const canais = [
  {
    key: "inbound",
    nome: "Inbound",
    funcao: "Filtra e qualifica",
    descricao: "Anúncios + LP + formulário com scoring. Atrai os Tipos 1 e 2 e bloqueia os DQs antes da call.",
    peso: 30,
    pesoLabel: "30% do pipeline",
    kpi: "% leads qualificados",
    kpiValor: "15–25%",
    contribuicao: "4–5 clientes",
    bgCls: "bg-amber-500/[0.05]",
    borderCls: "border-amber-500/30",
    barCls: "bg-amber-500",
    textCls: "text-amber-400",
    badge: "JÁ ATIVO",
  },
  {
    key: "outbound",
    nome: "Outbound",
    funcao: "Abre porta dos Tipo 3",
    descricao: "Lista ICP de incorporadoras R$50M+ trabalhada por LinkedIn e WhatsApp. Conversa direta baseada em VGV e estoque.",
    peso: 50,
    pesoLabel: "50% do pipeline",
    kpi: "Reuniões qualificadas/mês",
    kpiValor: "12–20",
    contribuicao: "6–8 clientes",
    bgCls: "bg-orange-500/[0.06]",
    borderCls: "border-orange-500/40",
    barCls: "bg-orange-500",
    textCls: "text-orange-400",
    badge: "MOTOR PRINCIPAL",
  },
  {
    key: "eventos",
    nome: "Eventos",
    funcao: "Conecta com decisor",
    descricao: "3–5 eventos setoriais por ano (GRI, ABRAINC, COMPLAN). Encontro presencial = ciclo de venda mais curto.",
    peso: 20,
    pesoLabel: "20% do pipeline",
    kpi: "Reuniões pós-evento",
    kpiValor: "2–4 por evento",
    contribuicao: "2–3 clientes",
    bgCls: "bg-emerald-500/[0.05]",
    borderCls: "border-emerald-500/30",
    barCls: "bg-emerald-500",
    textCls: "text-emerald-400",
    badge: "ALTA CONVERSÃO",
  },
];

function CanaisGrid() {
  return (
    <div className="grid md:grid-cols-3 gap-5">
      {canais.map((c) => (
        <div key={c.key} className={`rounded-2xl border ${c.borderCls} ${c.bgCls} p-6 flex flex-col`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-[10px] font-black uppercase tracking-widest ${c.textCls}`}>{c.badge}</span>
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">{c.pesoLabel}</span>
          </div>

          <h3 className="text-2xl font-extrabold text-white">{c.nome}</h3>
          <p className={`text-sm font-bold ${c.textCls} mb-3`}>{c.funcao}</p>

          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden mb-4">
            <div className={`h-full ${c.barCls} rounded-full`} style={{ width: `${c.peso}%` }} />
          </div>

          <p className="text-sm text-neutral-400 leading-relaxed mb-5 flex-1">{c.descricao}</p>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-neutral-800">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">KPI principal</p>
              <p className="text-sm font-bold text-white">{c.kpiValor}</p>
              <p className="text-[10px] text-neutral-500">{c.kpi}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Meta 2026</p>
              <p className={`text-sm font-bold ${c.textCls}`}>{c.contribuicao}</p>
              <p className="text-[10px] text-neutral-500">no Q4</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Bloco: Outbound estruturado ───────────────────────────────────────────
function OutboundBloco() {
  const criterios = [
    { label: "VGV ativo", desc: "R$ 50M+ por lançamento, com obras em andamento" },
    { label: "Volume de pipeline", desc: "2+ lançamentos/ano nos últimos 24 meses" },
    { label: "Região", desc: "SP capital + interior, BH, Curitiba, Goiânia" },
    { label: "Estágio sensível", desc: "Empreendimento com 30%+ de estoque após 6 meses" },
  ];

  const kpis = [
    { label: "Contatos qualificados", valor: "10–20", sub: "por dia útil" },
    { label: "Taxa de resposta", valor: "12–18%", sub: "abordagem certa" },
    { label: "Reuniões marcadas", valor: "12–20", sub: "por mês" },
  ];

  return (
    <Card>
      <div className="grid md:grid-cols-2 gap-8">
        {/* coluna esquerda: critérios + KPIs */}
        <div>
          <SectionLabel label="Outbound estruturado" />
          <h3 className="text-2xl font-extrabold text-white mb-2">Não esperamos os Tipo 3 — abrimos a porta deles</h3>
          <p className="text-neutral-400 text-sm leading-relaxed mb-6">
            Incorporadora R$50M+ não preenche formulário. A lista é construída a partir de dados públicos (CRECI,
            lançamentos, VGV, registros) e trabalhada com abordagem específica por empreendimento.
          </p>

          <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-3">Critérios da lista ICP</p>
          <div className="space-y-3 mb-6">
            {criterios.map((c) => (
              <div key={c.label} className="flex items-start gap-3">
                <Check c="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">{c.label}</p>
                  <p className="text-xs text-neutral-500">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-3">KPIs operacionais</p>
          <div className="grid grid-cols-3 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl bg-neutral-900 border border-neutral-800 p-3">
                <p className="text-lg font-extrabold text-orange-400 leading-none">{k.valor}</p>
                <p className="text-[10px] text-neutral-500 mt-1">{k.sub}</p>
                <p className="text-[10px] text-neutral-400 font-semibold mt-1.5">{k.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* coluna direita: exemplo de mensagem */}
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-3">Exemplo de abordagem real</p>

          <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-5 mb-4">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-neutral-800">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                <span className="text-orange-400 text-xs font-black">in</span>
              </div>
              <div>
                <p className="text-xs font-bold text-white">LinkedIn → Diretor comercial</p>
                <p className="text-[10px] text-neutral-500">Mensagem direta, sem pitch</p>
              </div>
            </div>
            <p className="text-sm text-neutral-200 leading-relaxed">
              <span className="text-neutral-400">Olá [Nome],</span><br /><br />
              Vi que vocês estão com o <strong className="text-white">[Empreendimento X]</strong> — pelo que cruzei,
              são cerca de <strong className="text-white">[X] unidades</strong>, com VGV próximo de
              <strong className="text-white"> R$ [Y]M</strong>.<br /><br />
              No ritmo atual de vendas registrado, isso aponta para algo como <strong className="text-orange-400">[Z] meses
              de estoque</strong> — situação que, em geral, começa a pressionar margem nos próximos lançamentos.<br /><br />
              Operamos uma estrutura que <strong className="text-white">acelera giro</strong> sem depender só de
              corretor — junta tráfego, qualificação e vendas no mesmo funil.<br /><br />
              Faz sentido <strong className="text-white">15min</strong> pra te mostrar como aplicaríamos no seu caso?
            </p>
          </div>

          <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-2">Por que funciona</p>
            <ul className="space-y-1.5 text-xs text-neutral-400">
              <li className="flex gap-2"><span className="text-orange-500">→</span> Mostra que a pesquisa foi feita (empreendimento + VGV)</li>
              <li className="flex gap-2"><span className="text-orange-500">→</span> Fala a língua dele: estoque, giro, margem</li>
              <li className="flex gap-2"><span className="text-orange-500">→</span> Oferece resultado tangível, não &quot;diagnóstico&quot;</li>
              <li className="flex gap-2"><span className="text-orange-500">→</span> Pede 15min, não &quot;uma conversa&quot;</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Bloco: Eventos ────────────────────────────────────────────────────────
function EventosBloco() {
  const eventos = [
    { sigla: "GRI", nome: "GRI Real Estate Brazil", quando: "Set", foco: "Decisores de incorporadoras de médio/alto padrão. Ambiente fechado, conversa real." },
    { sigla: "ABRAINC", nome: "ABRAINC + FIPE", quando: "Mar/Out", foco: "Associação dos grandes incorporadores. Dados de mercado + relacionamento institucional." },
    { sigla: "COMPLAN", nome: "Conexão Compradores", quando: "Mai", foco: "Foco em vendas e go-to-market. Diretores comerciais e marketing." },
    { sigla: "SECOVI", nome: "SECOVI Lançamentos", quando: "Ago", foco: "Cobertura SP. Bom para pipeline regional e cases locais." },
  ];

  const playbook = [
    {
      etapa: "Antes",
      cor: "amber",
      bgCls: "bg-amber-500/[0.05]",
      borderCls: "border-amber-500/30",
      textCls: "text-amber-400",
      acoes: [
        "Mapear 20–30 empresas-alvo confirmadas no evento",
        "Identificar decisores (LinkedIn + lista oficial)",
        "Agendar 5–10 conversas via mensagem prévia",
        "Preparar 1 case/dado relevante para cada conversa",
      ],
    },
    {
      etapa: "Durante",
      cor: "orange",
      bgCls: "bg-orange-500/[0.06]",
      borderCls: "border-orange-500/40",
      textCls: "text-orange-400",
      acoes: [
        "Foco em 5–10 interações profundas, não networking solto",
        "Conversa de vendas: VGV, giro, estoque — não marketing",
        "Coletar contexto real: o que está travando hoje",
        "Combinar próximo passo claro antes de sair",
      ],
    },
    {
      etapa: "Depois",
      cor: "emerald",
      bgCls: "bg-emerald-500/[0.05]",
      borderCls: "border-emerald-500/30",
      textCls: "text-emerald-400",
      acoes: [
        "Follow-up em até 48h com resumo + próximo passo",
        "Enviar 1 material aderente ao que foi conversado",
        "Marcar reunião estratégica em 7–14 dias",
        "Atualizar CRM com contexto e prioridade",
      ],
    },
  ];

  return (
    <Card>
      <div className="mb-8">
        <SectionLabel label="Eventos como canal" />
        <h3 className="text-2xl font-extrabold text-white mb-2">Onde os Tipo 3 efetivamente estão</h3>
        <p className="text-neutral-400 text-sm leading-relaxed max-w-3xl">
          Evento setorial não é networking — é canal de aquisição estruturado. Tratar como funil próprio,
          com meta clara e processo padrão antes/durante/depois.
        </p>
      </div>

      {/* eventos-alvo */}
      <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-3">Eventos-alvo do ano</p>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {eventos.map((e) => (
          <div key={e.sigla} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-base font-extrabold text-white">{e.sigla}</p>
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 px-2 py-0.5 rounded-full bg-orange-500/10">{e.quando}</span>
            </div>
            <p className="text-xs font-semibold text-neutral-300 mb-1.5">{e.nome}</p>
            <p className="text-xs text-neutral-500 leading-relaxed">{e.foco}</p>
          </div>
        ))}
      </div>

      {/* playbook */}
      <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-3">Playbook por evento</p>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {playbook.map((p, i) => (
          <div key={p.etapa} className={`rounded-2xl border ${p.borderCls} ${p.bgCls} p-5 relative`}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`w-7 h-7 rounded-full ${p.textCls} bg-neutral-900 border border-current flex items-center justify-center text-xs font-black`}>
                {i + 1}
              </span>
              <p className={`text-base font-extrabold ${p.textCls}`}>{p.etapa}</p>
            </div>
            <ul className="space-y-2">
              {p.acoes.map((a) => (
                <li key={a} className="flex gap-2 text-xs text-neutral-300 leading-relaxed">
                  <span className={`${p.textCls} shrink-0`}>•</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* meta */}
      <div className="rounded-xl bg-gradient-to-r from-orange-500/[0.08] to-transparent border border-orange-500/30 p-5 flex flex-wrap items-center gap-6">
        <p className="text-[11px] font-black uppercase tracking-widest text-orange-500">Meta por evento</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-extrabold text-white tabular-nums">2–4</p>
          <p className="text-xs text-neutral-400">reuniões qualificadas</p>
        </div>
        <span className="text-neutral-700">+</span>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-extrabold text-orange-400 tabular-nums">1</p>
          <p className="text-xs text-neutral-400">oportunidade real de cliente</p>
        </div>
      </div>
    </Card>
  );
}

// ─── Bloco: Canais → Meta ──────────────────────────────────────────────────
function CanaisMeta() {
  const linhas = [
    { canal: "Inbound",  fn: "Filtra Tipo 1/2",   clientes: "4–5",  ticket: "R$ 15–18k", textCls: "text-amber-400",  barCls: "bg-amber-500",  pct: 30 },
    { canal: "Outbound", fn: "Abre Tipo 3",       clientes: "6–8",  ticket: "R$ 20–25k", textCls: "text-orange-400", barCls: "bg-orange-500", pct: 50 },
    { canal: "Eventos",  fn: "Conecta decisor",   clientes: "2–3",  ticket: "R$ 22–30k", textCls: "text-emerald-400",barCls: "bg-emerald-500",pct: 20 },
  ];

  return (
    <Card className="bg-gradient-to-br from-orange-500/[0.04] to-transparent border-orange-500/20">
      <SectionLabel label="Canais → Meta R$ 2,5M" />
      <h3 className="text-2xl font-extrabold text-white mb-2">Como os 3 canais somam os 12–16 clientes do Q4</h3>
      <p className="text-neutral-400 text-sm leading-relaxed mb-6 max-w-3xl">
        Nenhum canal sozinho fecha a meta. O mix é desenhado para que cada um cubra um perfil de cliente
        diferente — e juntos formem a base recorrente de R$ 2,5M no fechamento de 2026.
      </p>

      <div className="space-y-3">
        {/* header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
          <div className="col-span-3">Canal</div>
          <div className="col-span-3">Função</div>
          <div className="col-span-2 text-right">Clientes Q4</div>
          <div className="col-span-2 text-right">Ticket médio</div>
          <div className="col-span-2 text-right">% pipeline</div>
        </div>

        {linhas.map((l) => (
          <div key={l.canal} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
            <div className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-4 md:items-center">
              <div className="md:col-span-3">
                <p className={`text-base font-extrabold ${l.textCls}`}>{l.canal}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-xs text-neutral-400">{l.fn}</p>
              </div>
              <div className="md:col-span-2 md:text-right">
                <p className="text-lg font-extrabold text-white tabular-nums">{l.clientes}</p>
              </div>
              <div className="md:col-span-2 md:text-right">
                <p className="text-sm font-bold text-neutral-300 tabular-nums">{l.ticket}</p>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 md:justify-end">
                  <span className={`text-sm font-bold ${l.textCls} tabular-nums`}>{l.pct}%</span>
                  <div className="w-20 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div className={`h-full ${l.barCls} rounded-full`} style={{ width: `${l.pct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* total */}
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/[0.06] p-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-4 md:items-center">
            <div className="md:col-span-6">
              <p className="text-xs uppercase tracking-widest text-orange-500 font-black">Total</p>
              <p className="text-base font-extrabold text-white">3 canais somados</p>
            </div>
            <div className="md:col-span-2 md:text-right">
              <p className="text-2xl font-extrabold text-orange-400 tabular-nums">12–16</p>
              <p className="text-[10px] text-neutral-500">clientes no Q4</p>
            </div>
            <div className="md:col-span-2 md:text-right">
              <p className="text-2xl font-extrabold text-white tabular-nums">~R$ 20k</p>
              <p className="text-[10px] text-neutral-500">ticket médio</p>
            </div>
            <div className="md:col-span-2 md:text-right">
              <p className="text-2xl font-extrabold text-orange-400 tabular-nums">R$ 2,5M+</p>
              <p className="text-[10px] text-neutral-500">faturamento ano</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────
export function MixAquisicao() {
  return (
    <div className="space-y-8">
      {/* frase guia */}
      <div className="text-center">
        <p className="inline-block text-base md:text-lg font-bold text-neutral-300 px-6 py-3 rounded-full bg-neutral-900 border border-neutral-800">
          <span className="text-amber-400">Inbound filtra.</span>{" "}
          <span className="text-orange-400">Outbound abre.</span>{" "}
          <span className="text-emerald-400">Evento conecta.</span>
        </p>
      </div>

      <CanaisGrid />
      <OutboundBloco />
      <EventosBloco />
      <CanaisMeta />
    </div>
  );
}
