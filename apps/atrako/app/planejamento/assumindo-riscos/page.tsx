"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── accent color ──────────────────────────────────────────────────────────────
const RED = "#ff6a00";
const RED_SOFT = "#ff9a40";
const RED_DIM = "rgba(255,106,0,0.12)";
const RED_BORDER = "rgba(255,106,0,0.25)";

// ─── helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number, d = 1): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(d)} tri`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(d)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(d)}k`;
  return `R$ ${v.toFixed(0)}`;
}

// ─── icons ─────────────────────────────────────────────────────────────────────
const Ico = {
  Back: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Alert: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Filter: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M1 12h3M20 12h3M12 1v3M12 20v3"/>
    </svg>
  ),
  Rocket: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  ),
  Activity: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  DollarSign: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  Shield: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Target: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Bot: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="5" r="2"/><path d="M8 15h.01M16 15h.01M8 19h8"/>
    </svg>
  ),
  TrendingUp: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Slash: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  ),
  Calendar: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
};

// ─── primitives ────────────────────────────────────────────────────────────────
function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl border border-neutral-800 bg-[#18181b] p-6 ${className}`} style={style}>
      {children}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] mb-4" style={{ color: RED }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: RED }} />
      {label}
    </p>
  );
}

function SectionTitle({ title, sub, center = true }: { title: React.ReactNode; sub?: string; center?: boolean }) {
  return (
    <div className={center ? "text-center mb-12" : "mb-10"}>
      <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">{title}</h2>
      {sub && <p className="text-neutral-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">{sub}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean; payload?: { name: string; value: number }[];
  label?: string; formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-neutral-700 bg-[#1c1c1e] px-4 py-3 shadow-2xl text-sm">
      {label && <p className="text-neutral-400 mb-1 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: RED }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "manifesto", label: "Manifesto" },
  { id: "filtro", label: "Filtro" },
  { id: "setup", label: "Setup" },
  { id: "processo", label: "Processo" },
  { id: "operacao", label: "Operação" },
  { id: "funil", label: "Funil" },
  { id: "modelo", label: "Modelo" },
  { id: "travas", label: "Travas" },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// ─── SIMULATOR: REVENUE MODEL ─────────────────────────────────────────────────
function SimuladorReceita() {
  const [feeBase, setFeeBase] = useState(9000);
  const [unidadesVendidas, setUnidadesVendidas] = useState(15);
  const [valorPorUnidade, setValorPorUnidade] = useState(2000);
  const [vgv, setVgv] = useState(80);
  const [pctVgv, setPctVgv] = useState(0.5);
  const [modo, setModo] = useState<"unidade" | "vgv">("unidade");

  const variavel = modo === "unidade"
    ? unidadesVendidas * valorPorUnidade
    : (vgv * 1_000_000 * pctVgv) / 100;

  const total = feeBase * 12 + variavel;
  const apenasFixo = feeBase * 12;
  const upside = total - apenasFixo;
  const multiplicador = apenasFixo > 0 ? total / apenasFixo : 0;

  const bars = [
    { name: "Apenas fee fixo", value: apenasFixo, color: "#525252" },
    { name: "Com variável", value: total, color: RED },
  ];

  return (
    <Card className="space-y-6">
      <div>
        <SectionLabel label="Simulador de Receita" />
        <h3 className="text-xl font-extrabold text-white mb-1">Quanto você ganha nesse modelo?</h3>
        <p className="text-neutral-400 text-sm">Compare o fee fixo puro versus o modelo variável atrelado a resultado.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-400 font-medium">Fee mensal base</span>
            <span className="font-bold" style={{ color: RED_SOFT }}>{fmt(feeBase, 0)}/mês</span>
          </div>
          <input type="range" min={7000} max={15000} step={500} value={feeBase}
            onChange={e => setFeeBase(+e.target.value)}
            className="w-full cursor-pointer" style={{ accentColor: RED }} />
        </div>

        <div className="rounded-xl border border-neutral-700 bg-[#111] p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Componente variável</p>
          <div className="flex gap-2">
            {(["unidade", "vgv"] as const).map(m => (
              <button key={m} onClick={() => setModo(m)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all ${modo === m ? "text-white" : "text-neutral-500 bg-neutral-800 hover:bg-neutral-700"}`}
                style={modo === m ? { background: RED } : undefined}>
                {m === "unidade" ? "R$ por unidade" : "% do VGV"}
              </button>
            ))}
          </div>

          {modo === "unidade" ? (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Unidades vendidas no contrato</span>
                  <span className="text-white font-bold">{unidadesVendidas} un.</span>
                </div>
                <input type="range" min={1} max={80} step={1} value={unidadesVendidas}
                  onChange={e => setUnidadesVendidas(+e.target.value)}
                  className="w-full cursor-pointer" style={{ accentColor: RED }} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">R$ por unidade vendida</span>
                  <span className="text-white font-bold">{fmt(valorPorUnidade, 0)}</span>
                </div>
                <input type="range" min={500} max={5000} step={250} value={valorPorUnidade}
                  onChange={e => setValorPorUnidade(+e.target.value)}
                  className="w-full cursor-pointer" style={{ accentColor: RED }} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">VGV do empreendimento</span>
                  <span className="text-white font-bold">R$ {vgv}M</span>
                </div>
                <input type="range" min={20} max={500} step={10} value={vgv}
                  onChange={e => setVgv(+e.target.value)}
                  className="w-full cursor-pointer" style={{ accentColor: RED }} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">% do VGV vendido</span>
                  <span className="text-white font-bold">{pctVgv.toFixed(2)}%</span>
                </div>
                <input type="range" min={0.1} max={1.5} step={0.05} value={pctVgv}
                  onChange={e => setPctVgv(+e.target.value)}
                  className="w-full cursor-pointer" style={{ accentColor: RED }} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
            <XAxis type="number" tickFormatter={v => fmt(v, 0)} tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#aaa", fontSize: 11 }} axisLine={false} tickLine={false} width={130} />
            <Tooltip content={<ChartTooltip formatter={v => fmt(v, 1)} />} />
            <Bar dataKey="value" name="Valor anual" radius={[0, 6, 6, 0]}>
              {bars.map((b, i) => <Cell key={i} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4 bg-neutral-800/50 text-center">
          <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">Fee anual</p>
          <p className="text-lg font-extrabold text-white">{fmt(apenasFixo, 1)}</p>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ background: RED_DIM, border: `1px solid ${RED_BORDER}` }}>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: RED }}>+ Variável</p>
          <p className="text-lg font-extrabold" style={{ color: RED_SOFT }}>+{fmt(variavel, 1)}</p>
        </div>
        <div className="rounded-xl p-4 bg-white/[0.04] text-center border border-white/10">
          <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">Total / ano</p>
          <p className="text-lg font-extrabold text-white">{fmt(total, 1)}</p>
          <p className="text-xs mt-0.5" style={{ color: RED }}>{multiplicador.toFixed(1)}× o fixo</p>
        </div>
      </div>
    </Card>
  );
}

// ─── SIMULATOR: FUNIL DE CONVERSÃO ────────────────────────────────────────────
function SimuladorFunil() {
  const [leads, setLeads] = useState(300);
  const [pctContato, setPctContato] = useState(60);
  const [pctQualificado, setPctQualificado] = useState(40);
  const [pctAgendado, setPctAgendado] = useState(50);
  const [pctVisitou, setPctVisitou] = useState(70);
  const [pctVenda, setPctVenda] = useState(20);

  const contatos = Math.round(leads * pctContato / 100);
  const qualificados = Math.round(contatos * pctQualificado / 100);
  const agendados = Math.round(qualificados * pctAgendado / 100);
  const visitas = Math.round(agendados * pctVisitou / 100);
  const vendas = Math.round(visitas * pctVenda / 100);
  const conversaoGeral = leads > 0 ? ((vendas / leads) * 100).toFixed(2) : "0";

  const stages = [
    { label: "Leads", value: leads, color: "#525252", pct: null },
    { label: "Contato", value: contatos, color: "#6b7280", pct: pctContato },
    { label: "Qualificado", value: qualificados, color: "#854d0e", pct: pctQualificado },
    { label: "Agendado", value: agendados, color: "#92400e", pct: pctAgendado },
    { label: "Visitou", value: visitas, color: "#b45309", pct: pctVisitou },
    { label: "Venda", value: vendas, color: RED, pct: pctVenda },
  ];

  const sliders = [
    { label: "% Contato realizado", value: pctContato, set: setPctContato },
    { label: "% Qualificação", value: pctQualificado, set: setPctQualificado },
    { label: "% Agendamento", value: pctAgendado, set: setPctAgendado },
    { label: "% Comparecimento", value: pctVisitou, set: setPctVisitou },
    { label: "% Fechamento", value: pctVenda, set: setPctVenda },
  ];

  return (
    <Card className="space-y-6">
      <div>
        <SectionLabel label="Simulador de Funil" />
        <h3 className="text-xl font-extrabold text-white mb-1">Onde o dinheiro está sendo perdido?</h3>
        <p className="text-neutral-400 text-sm">Ajuste as taxas de conversão por etapa e identifique o gargalo.</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-400 font-medium">Leads gerados no período</span>
          <span className="font-bold text-white">{leads}</span>
        </div>
        <input type="range" min={50} max={2000} step={50} value={leads}
          onChange={e => setLeads(+e.target.value)}
          className="w-full cursor-pointer" style={{ accentColor: RED }} />
      </div>

      <div className="space-y-2">
        {sliders.map(({ label, value, set }) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">{label}</span>
              <span className="text-white font-bold">{value}%</span>
            </div>
            <input type="range" min={5} max={100} step={5} value={value}
              onChange={e => set(+e.target.value)}
              className="w-full cursor-pointer" style={{ accentColor: RED }} />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {stages.map((s, i) => {
          const width = leads > 0 ? (s.value / leads) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-20 text-right text-xs text-neutral-400 shrink-0">{s.label}</span>
              <div className="flex-1 h-7 rounded-lg bg-neutral-800 overflow-hidden relative">
                <div className="h-full rounded-lg transition-all duration-300" style={{ width: `${width}%`, background: s.color }} />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {s.value}
                  {s.pct !== null && <span className="ml-1 text-neutral-300 font-normal">({s.pct}%)</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl p-4 text-center" style={{ background: RED_DIM, border: `1px solid ${RED_BORDER}` }}>
        <p className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-1">Conversão geral lead → venda</p>
        <p className="text-3xl font-extrabold" style={{ color: RED_SOFT }}>{conversaoGeral}%</p>
        <p className="text-xs text-neutral-400 mt-1">
          {vendas} {vendas === 1 ? "venda" : "vendas"} de {leads} leads
        </p>
      </div>
    </Card>
  );
}

// ─── FILTRO DE ELEGIBILIDADE ──────────────────────────────────────────────────
function FiltroElegibilidade() {
  const criterios = [
    { id: "vgv", label: "VGV ≥ R$ 50M", desc: "O tamanho do empreendimento precisa justificar o modelo variável. Abaixo disso, a matemática não fecha.", critical: true },
    { id: "estoque", label: "Estoque relevante (dor real)", desc: "Precisa ter unidades paradas e sentir a pressão disso. Sem dor, não há comprometimento com o processo.", critical: true },
    { id: "time", label: "Time comercial ativo", desc: "Você não substitui o time de vendas — você opera junto dele. Se o time está morto, o modelo não funciona.", critical: true },
    { id: "processo", label: "Topa seguir processo", desc: "SLA, CRM, script, reunião semanal com dados. Quem achar que é opcional está fora do modelo.", critical: true },
  ];

  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setMarcados(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const todos = marcados.size === criterios.length;
  const nenhum = marcados.size === 0;

  return (
    <Card className="space-y-5">
      <div>
        <SectionLabel label="Filtro de Entrada" />
        <h3 className="text-xl font-extrabold text-white mb-1">Esse cliente é elegível?</h3>
        <p className="text-neutral-400 text-sm">Marque os critérios que o prospect atende. Falhar em qualquer um elimina do modelo variável.</p>
      </div>

      <div className="space-y-3">
        {criterios.map(c => {
          const ativo = marcados.has(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${ativo ? "border-emerald-500/40 bg-emerald-500/5" : "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700"}`}>
              <div className="flex items-start gap-3">
                <div className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${ativo ? "bg-emerald-500 text-white" : "border border-neutral-600 text-neutral-600"}`}>
                  {ativo ? <Ico.Check /> : <Ico.X />}
                </div>
                <div>
                  <p className={`font-bold text-sm ${ativo ? "text-white" : "text-neutral-400"}`}>{c.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{c.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className={`rounded-xl p-4 border text-center ${todos ? "border-emerald-500/30 bg-emerald-500/5" : nenhum ? "border-neutral-700 bg-neutral-900/50" : "border-red-500/30 bg-red-500/5"}`}>
        {todos ? (
          <>
            <p className="text-emerald-400 font-black text-base">✓ Cliente elegível</p>
            <p className="text-xs text-neutral-400 mt-1">Pode entrar no modelo Assumindo Riscos</p>
          </>
        ) : nenhum ? (
          <>
            <p className="text-neutral-400 font-bold text-sm">Marque os critérios acima</p>
            <p className="text-xs text-neutral-500 mt-1">Avalie cada ponto com honestidade</p>
          </>
        ) : (
          <>
            <p className="text-red-400 font-black text-base">✗ Não elegível nesse momento</p>
            <p className="text-xs text-neutral-400 mt-1">
              {4 - marcados.size} critério{4 - marcados.size !== 1 ? "s" : ""} bloqueante{4 - marcados.size !== 1 ? "s" : ""}. Ofereça modelo fixo tradicional.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function AssumindoRiscosPage() {
  return (
    <div className="min-h-screen bg-[#0f0f11] text-white">

      {/* ── TOP NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0f0f11]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-4 py-3">
            <Link href="/planejamento"
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors text-sm shrink-0">
              <Ico.Back /> Planejamento
            </Link>
            <div className="h-4 w-px bg-neutral-700" />
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {NAV.map(n => (
                <button key={n.id} onClick={() => scrollTo(n.id)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-all whitespace-nowrap">
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-24">

        {/* ── HERO ── */}
        <section id="manifesto">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#14141a] px-8 py-14 sm:px-12 text-center">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-10 blur-3xl" style={{ background: RED }} />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full opacity-5 blur-3xl" style={{ background: RED }} />

            <div className="relative">
              <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] mb-6" style={{ color: RED }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: RED }} />
                Inout Digital · Modelo Estratégico
              </p>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6">
                <span className="text-white">Assumindo</span>
                <br />
                <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${RED}, #ff9a40)` }}>
                  Riscos
                </span>
              </h1>

              <p className="text-neutral-300 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
                Você não vende tráfego. Você implanta um{" "}
                <span className="text-white font-semibold">sistema de geração e conversão forçada de demanda</span>{" "}
                — e recebe pelo resultado, não pela entrega.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
                {[
                  "Para imobiliários VGV ≥ R$ 50M",
                  "Fee fixo + variável atrelado a vendas",
                  "Operação diária dentro do comercial",
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-800/50 px-4 py-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RED }} />
                    <span className="text-neutral-300">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparativo: modelo clássico vs assumindo riscos */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-neutral-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-400">
                  <Ico.Slash />
                </div>
                <p className="font-bold text-neutral-400">Modelo Clássico</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Entrega leads, não resultado",
                  "Fee fixo, sem skin in the game",
                  "Relatório mensal de métricas",
                  "Depende do corretor converter",
                  "Justifica com alcance e impressões",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-neutral-400">
                    <span className="mt-0.5 text-neutral-600 shrink-0"><Ico.X /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </Card>

            <Card style={{ border: `1px solid ${RED_BORDER}`, background: "#141008" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: RED }}>
                  <Ico.Rocket />
                </div>
                <p className="font-bold text-white">Assumindo Riscos</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  "Implanta sistema de conversão forçada",
                  "Variável atrelado a vendas reais",
                  "Opera o comercial junto, todo dia",
                  "Controla da entrada à proposta",
                  "Justifica com VGV e unidades vendidas",
                ].map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white">
                    <span className="mt-0.5 shrink-0" style={{ color: RED }}><Ico.Check /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        {/* ── FILTRO ── */}
        <section id="filtro">
          <SectionTitle
            title={<>Filtro de Entrada <span style={{ color: RED }}>(Crítico)</span></>}
            sub="Esse é o momento mais importante do processo. Entrar no cliente errado é pior do que não entrar."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FiltroElegibilidade />
            <Card className="space-y-4">
              <div>
                <SectionLabel label="O que acontece se entrar errado" />
                <h3 className="text-xl font-extrabold text-white mb-1">Custo do erro de avaliação</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">Entrar no modelo variável com o cliente errado não é só perda de dinheiro — é perda de reputação e energia.</p>
              </div>
              <div className="space-y-3 mt-2">
                {[
                  { titulo: "Time morto", desc: "Sem time ativo, você vira o único motor. Operação insustentável e resultado zero.", color: "text-red-400" },
                  { titulo: "Sem CRM", desc: "Leads somem, atribuição fica impossível, variável vira loteria sem comprovação.", color: "text-red-400" },
                  { titulo: "Não segue SLA", desc: "Lead esfria, corretor ignora, você continua pagando API e serviços — sem retorno.", color: "text-red-400" },
                  { titulo: "VGV pequeno", desc: "Variável de 0,5% do VGV em R$ 8M = R$ 40k. Não justifica o esforço operacional do modelo.", color: "text-orange-400" },
                ].map(({ titulo, desc, color }) => (
                  <div key={titulo} className="flex gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                    <span className={`${color} shrink-0 mt-0.5`}><Ico.Alert /></span>
                    <div>
                      <p className={`font-bold text-sm ${color}`}>{titulo}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* ── SETUP ── */}
        <section id="setup">
          <SectionTitle
            title="Setup Inicial"
            sub="Semanas 1 e 2. Sem essa infraestrutura, o processo não tem onde rodar."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: RED_DIM }}>
                  <span style={{ color: RED }}><Ico.Settings /></span>
                </div>
                <h3 className="font-extrabold text-white">Infraestrutura Obrigatória</h3>
              </div>
              <div className="space-y-3">
                {[
                  { t: "CRM organizado", d: "Funil com etapas claras: Lead → Qualificado → Agendado → Visitou → Proposta → Venda" },
                  { t: "Integração leads → CRM", d: "Zero lead por WhatsApp solto. Tudo registrado automaticamente com origem" },
                  { t: "Tracking de origem", d: "UTM em todos os anúncios. Sem isso, o variável não pode ser auditado" },
                ].map(({ t, d }) => (
                  <div key={t} className="rounded-xl border border-neutral-800 p-4">
                    <p className="font-bold text-white text-sm">{t}</p>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{d}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: RED_DIM }}>
                  <span style={{ color: RED }}><Ico.Target /></span>
                </div>
                <h3 className="font-extrabold text-white">Definições e SLAs</h3>
              </div>
              <div className="space-y-3">
                {[
                  { t: "SLA de atendimento", items: ["Resposta ao lead em ≤ 5 minutos", "Mínimo 5 tentativas de contato", "Registro de cada tentativa no CRM"] },
                  { t: "Script padrão", items: ["Template WhatsApp validado", "Script de ligação por fase do funil", "Critério objetivo de qualificação"] },
                ].map(({ t, items }) => (
                  <div key={t} className="rounded-xl border border-neutral-800 p-4">
                    <p className="font-bold text-white text-sm mb-2">{t}</p>
                    <ul className="space-y-1">
                      {items.map(item => (
                        <li key={item} className="flex items-start gap-2 text-xs text-neutral-400">
                          <span className="shrink-0 mt-0.5" style={{ color: RED }}><Ico.Check /></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* ── PROCESSO ── */}
        <section id="processo">
          <SectionTitle
            title="Processo Fim a Fim"
            sub="Os 6 estágios do lead até a venda — e o que você controla em cada um."
          />

          <div className="relative">
            {/* linha vertical */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-neutral-800 hidden sm:block" />

            <div className="space-y-4">
              {[
                {
                  num: "01", etapa: "Lead entra", cor: "#525252",
                  desc: "Origem rastreada. Vai direto pro CRM, não pro WhatsApp do corretor.",
                  acao: "Você garante: UTM, formulário, API de integração",
                  icon: <Ico.Target />,
                },
                {
                  num: "02", etapa: "IA pré-qualifica", cor: "#7c3aed",
                  desc: "Antes de qualquer corretor ver o lead, a IA faz o primeiro contato, classifica (quente/morno/frio) e entrega o contexto completo.",
                  acao: "Você garante: prompt, fluxo, critério de classificação",
                  icon: <Ico.Bot />,
                },
                {
                  num: "03", etapa: "Distribuição controlada", cor: "#1d4ed8",
                  desc: "Round robin ou ranking por performance. Não respondeu rápido? Perde o lead. Não atualizou CRM? Perde o lead.",
                  acao: "Você garante: regra de distribuição, monitoramento",
                  icon: <Ico.Users />,
                },
                {
                  num: "04", etapa: "Operação diária", cor: "#b45309",
                  desc: "Todo dia: ver tempo de resposta, leads sem contato, leads parados. Cobrar corretor específico. Redistribuir. Ajustar abordagem.",
                  acao: "Você garante: presença diária, registro de ações, pressão",
                  icon: <Ico.Activity />,
                },
                {
                  num: "05", etapa: "Reunião semanal", cor: "#065f46",
                  desc: "Não é reunião de opinião. É reunião de dados: leads gerados, taxas de funil, gargalo da semana, ação clara de saída.",
                  acao: "Você garante: deck com dados, decisão tomada na sala",
                  icon: <Ico.Calendar />,
                },
                {
                  num: "06", etapa: "Venda atribuída", cor: RED,
                  desc: "Janela de até 90 dias. Lead gerado pela estratégia, venda confirmada no CRM — variável é acionado.",
                  acao: "Você garante: regra contratual, rastreabilidade completa",
                  icon: <Ico.DollarSign />,
                },
              ].map(({ num, etapa, cor, desc, acao, icon }) => (
                <div key={num} className="sm:pl-16 relative">
                  {/* círculo no eixo */}
                  <div className="absolute left-0 top-5 hidden sm:flex w-12 h-12 items-center justify-center rounded-full border-2 border-neutral-800 bg-[#0f0f11] text-white z-10" style={{ borderColor: cor + "50" }}>
                    <span style={{ color: cor }}>{icon}</span>
                  </div>

                  <div className="rounded-2xl border border-neutral-800 bg-[#18181b] p-5 flex gap-4">
                    <div className="shrink-0 sm:hidden w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: cor + "20" }}>
                      <span style={{ color: cor }}>{icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-black uppercase tracking-widest" style={{ color: cor }}>{num}</span>
                        <span className="font-extrabold text-white">{etapa}</span>
                      </div>
                      <p className="text-sm text-neutral-400 leading-relaxed mb-2">{desc}</p>
                      <p className="text-xs font-bold text-neutral-500 border-l-2 pl-3" style={{ borderColor: cor + "60" }}>{acao}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── OPERAÇÃO ── */}
        <section id="operacao">
          <SectionTitle
            title={<>Operação Diária — <span style={{ color: RED }}>Seu diferencial real</span></>}
            sub="Não existe 'acompanhar'. Existe operar junto. Todo dia."
            center={false}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {[
              {
                icon: <Ico.Activity />,
                titulo: "O que você vê",
                items: ["Tempo médio de resposta por corretor", "Leads sem nenhum contato feito", "Leads parados há mais de 48h", "Taxa de atualização do CRM"],
              },
              {
                icon: <Ico.Target />,
                titulo: "O que você faz",
                items: ["Cobra corretor específico por nome", "Redistribui lead antes de esfriar", "Ajusta script se taxa de agendamento cair", "Bloqueia corretor que não segue SLA"],
              },
              {
                icon: <Ico.TrendingUp />,
                titulo: "O que você mede",
                items: ["% contato realizado em < 5 min", "% qualificação sobre contatos", "% agendamento sobre qualificados", "% comparecimento e fechamento"],
              },
            ].map(({ icon, titulo, items }) => (
              <Card key={titulo} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: RED_DIM }}>
                    <span style={{ color: RED }}>{icon}</span>
                  </div>
                  <h3 className="font-extrabold text-white text-sm">{titulo}</h3>
                </div>
                <ul className="space-y-2">
                  {items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-xs text-neutral-300">
                      <span className="shrink-0 mt-0.5" style={{ color: RED }}><Ico.Check /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <Card style={{ border: `1px solid ${RED_BORDER}`, background: "#141008" }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: RED }}>
                <Ico.Alert />
              </div>
              <div>
                <p className="font-black text-white text-base mb-1">O que 99% não faz — e é exatamente por isso que você cobra variável</p>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Todo mundo entrega leads. Ninguém entra no CRM do cliente todo dia, cobra corretor por nome, puxa lead parado e ajusta abordagem em tempo real.
                  Esse nível de operação é o que justifica a participação no resultado. É o que transforma tráfego em motor de vendas.
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* ── FUNIL ── */}
        <section id="funil">
          <SectionTitle
            title="Gestão de Funil"
            sub="O dinheiro está em saber onde o funil quebra — e atuar no gargalo antes que o mês feche."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimuladorFunil />
            <Card className="space-y-4">
              <div>
                <SectionLabel label="Diagnóstico por etapa" />
                <h3 className="text-xl font-extrabold text-white mb-1">Onde você atua quando quebra</h3>
                <p className="text-neutral-400 text-sm">Cada gargalo tem uma causa e uma ação específica. Não tem chutômetro.</p>
              </div>
              <div className="space-y-3">
                {[
                  {
                    problema: "Muitos leads, pouco contato",
                    causa: "SLA não está sendo seguido",
                    acao: "Redistribuir, cobrar, rever regra de distribuição",
                    cor: "text-red-400",
                  },
                  {
                    problema: "Contato alto, qualificação baixa",
                    causa: "Script fraco ou critério de qualificação impreciso",
                    acao: "Revisar script, ajustar perguntas de qualificação",
                    cor: "text-orange-400",
                  },
                  {
                    problema: "Qualificado, mas não agenda",
                    causa: "Falta urgência ou oferta no momento do contato",
                    acao: "Testar abordagem de agendamento, criar gatilho de escassez",
                    cor: "text-yellow-400",
                  },
                  {
                    problema: "Agendado, mas não comparece",
                    causa: "Nenhuma confirmação ou confirmação fraca",
                    acao: "Fluxo de confirmação em 3 touchpoints: D-1, D0 manhã, D0 antes",
                    cor: "text-blue-400",
                  },
                  {
                    problema: "Visitou, mas não fecha",
                    causa: "Problema do corretor ou do produto/preço",
                    acao: "Ouvir gravação da visita, ajustar argumento ou trocar corretor",
                    cor: "text-purple-400",
                  },
                ].map(({ problema, causa, acao, cor }) => (
                  <div key={problema} className="rounded-xl border border-neutral-800 p-4 space-y-1">
                    <p className={`font-bold text-xs uppercase tracking-wide ${cor}`}>{problema}</p>
                    <p className="text-xs text-neutral-500"><span className="text-neutral-400 font-semibold">Causa:</span> {causa}</p>
                    <p className="text-xs text-neutral-500"><span className="text-neutral-400 font-semibold">Ação:</span> {acao}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* ── MODELO ── */}
        <section id="modelo">
          <SectionTitle
            title="Modelo de Cobrança"
            sub="Fee fixo garante a operação. Variável é onde o upside real mora."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SimuladorReceita />
            <div className="space-y-4">
              <Card className="space-y-4">
                <SectionLabel label="Estrutura do contrato" />
                <div className="space-y-3">
                  <div className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-1">Fee fixo mensal</p>
                    <p className="text-2xl font-extrabold text-white">R$ 7k — R$ 12k</p>
                    <p className="text-xs text-neutral-500 mt-1">Cobre operação, setup, IA e reuniões semanais</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ border: `1px solid ${RED_BORDER}`, background: RED_DIM }}>
                    <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: RED }}>Variável — escolha 1</p>
                    <div className="space-y-2 mt-2">
                      <div className="rounded-lg bg-black/30 p-3">
                        <p className="text-xs font-bold text-white mb-0.5">Opção A — por unidade (mais simples)</p>
                        <p className="text-sm font-extrabold" style={{ color: RED_SOFT }}>R$ 1.000 — R$ 3.000 por unidade vendida</p>
                        <p className="text-xs text-neutral-400 mt-0.5">Fácil de auditar, sem discussão de margem</p>
                      </div>
                      <div className="rounded-lg bg-black/30 p-3">
                        <p className="text-xs font-bold text-white mb-0.5">Opção B — % do VGV vendido (mais agressivo)</p>
                        <p className="text-sm font-extrabold" style={{ color: RED_SOFT }}>0,3% — 1% do VGV atribuído</p>
                        <p className="text-xs text-neutral-400 mt-0.5">Upside maior, exige regra de atribuição sólida</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="space-y-3">
                <SectionLabel label="Ritual semanal" />
                <h3 className="font-extrabold text-white mb-0">Reunião com dados, não com opinião</h3>
                <div className="space-y-2">
                  {[
                    { t: "Entrada", d: "Leads gerados, custo por lead, origem com melhor qualidade" },
                    { t: "Funil", d: "Taxa de contato, qualificação, agendamento, comparecimento" },
                    { t: "Gargalo", d: "Etapa com maior queda — uma por semana, uma ação" },
                    { t: "Saída", d: "Decisão específica: mudar script, trocar corretor, ajustar campanha" },
                  ].map(({ t, d }) => (
                    <div key={t} className="flex gap-3 items-start text-sm">
                      <span className="font-black text-xs uppercase tracking-wider pt-0.5 w-16 shrink-0" style={{ color: RED }}>{t}</span>
                      <span className="text-neutral-400 leading-relaxed">{d}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ── TRAVAS ── */}
        <section id="travas">
          <SectionTitle
            title="Travas Contratuais"
            sub="Sem isso, você vira refém. Cada cláusula existe para proteger o modelo."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: RED_DIM }}>
                  <span style={{ color: RED }}><Ico.Shield /></span>
                </div>
                <h3 className="font-extrabold text-white">Cláusulas obrigatórias</h3>
              </div>
              {[
                {
                  t: "SLA contratual",
                  d: "Tempo de resposta ≤ 5 minutos e mínimo de 5 tentativas são obrigação do cliente, não sugestão. Descumprir pode acionar penalidade.",
                },
                {
                  t: "Acesso ao CRM",
                  d: "Você precisa de acesso irrestrito ao CRM em tempo real. Sem acesso = sem operação = sem variável.",
                },
                {
                  t: "Regra de atribuição",
                  d: "Vendas em até 90 dias da geração do lead pela estratégia contam para o variável. Precisa estar escrita e assinada.",
                },
                {
                  t: "Leads não atendidos",
                  d: "Lead sem contato em X minutos pode ser redistribuído sem necessidade de aprovação. Você tem autonomia operacional.",
                },
              ].map(({ t, d }) => (
                <div key={t} className="rounded-xl border border-neutral-800 p-4">
                  <p className="font-bold text-white text-sm mb-1">{t}</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">{d}</p>
                </div>
              ))}
            </Card>

            <div className="space-y-4">
              <Card style={{ border: `1px solid ${RED_BORDER}`, background: "#141008" }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: RED }}>
                    <Ico.Alert />
                  </div>
                  <h3 className="font-extrabold text-white">Regra de Corte — proteção sua</h3>
                </div>
                <p className="text-sm text-neutral-300 leading-relaxed mb-4">
                  Se o cliente não seguir SLA, não usar o CRM corretamente ou não executar o processo — você tem o direito contratual de:
                </p>
                <div className="space-y-2">
                  {[
                    { acao: "Remover o componente variável", nivel: "Primeiro aviso" },
                    { acao: "Encerrar contrato sem multa rescisória", nivel: "Reincidência" },
                  ].map(({ acao, nivel }) => (
                    <div key={acao} className="flex items-center justify-between rounded-xl bg-black/30 px-4 py-3">
                      <span className="text-sm text-white font-medium">{acao}</span>
                      <span className="text-xs rounded-full px-3 py-1 font-bold" style={{ background: RED_DIM, color: RED_SOFT }}>{nivel}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-4 leading-relaxed">
                  Sem essa cláusula você fica refém de quem não executa e ainda assim cobra resultado de você.
                </p>
              </Card>

              <Card className="space-y-3">
                <SectionLabel label="Resumo da lógica" />
                <h3 className="font-extrabold text-white">Funciona quando você controla os 5 pontos</h3>
                <div className="space-y-2 mt-1">
                  {[
                    "Controla a entrada (geração de lead)",
                    "Controla o meio (qualificação + distribuição)",
                    "Influencia fortemente o comercial (diariamente)",
                    "Mede tudo (funil, taxas, gargalo)",
                    "Força execução (SLA, CRM, processo)",
                  ].map((t, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                      <span className="shrink-0 mt-0.5 font-black text-xs" style={{ color: RED }}>0{i + 1}</span>
                      {t}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* CTA final */}
          <div className="relative overflow-hidden rounded-3xl text-center px-8 py-14" style={{ background: "linear-gradient(135deg, #140a00, #1a0f00)" }}>
            <div className="pointer-events-none absolute inset-0 rounded-3xl border" style={{ borderColor: RED_BORDER }} />
            <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-15 blur-3xl" style={{ background: RED }} />

            <div className="relative">
              <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] mb-4" style={{ color: RED }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: RED }} />
                Verdade final
              </p>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
                Tráfego gourmet ou<br />
                <span style={{ color: RED_SOFT }}>motor de vendas?</span>
              </h2>
              <p className="text-neutral-300 max-w-xl mx-auto text-base leading-relaxed mb-8">
                Quem só entrega tráfego depende do corretor, justifica com alcance e convive com variável virando loteria.
                Quem opera o comercial junto vira parte do motor — e consegue justificar a participação no resultado com dados.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/planejamento"
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors">
                  <Ico.Back /> Voltar ao planejamento
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
