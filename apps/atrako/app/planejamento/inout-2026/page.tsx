"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, RadialBarChart, RadialBar, ReferenceLine,
} from "recharts";
import { AquisicaoQualificada } from "./AquisicaoQualificada";
import { MixAquisicao } from "./MixAquisicao";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number, decimals = 1): string {
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(decimals)} tri`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(decimals)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(decimals)}k`;
  return `R$ ${v.toFixed(0)}`;
}
function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

// ─── inline icons ─────────────────────────────────────────────────────────────
const Ico = {
  Target: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  Zap: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  TrendingUp: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  Users: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Check: ({ c = "w-4 h-4" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: ({ c = "w-4 h-4" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Arrow: ({ c = "w-4 h-4" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Building: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
    </svg>
  ),
  Brain: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.64Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.64Z"/>
    </svg>
  ),
  DollarSign: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  CityBuilding: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="9" height="14"/><rect x="11" y="3" width="9" height="18"/><path d="M2 21h20"/><path d="M5 10h3M5 14h3M5 18h3"/><path d="M14 6h3M14 10h3M14 14h3M14 18h3"/>
    </svg>
  ),
  Home: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><polyline points="9 21 9 12 15 12 15 21"/>
    </svg>
  ),
  Leaf: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>
  ),
  Bot: ({ c = "w-5 h-5" }) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V7"/><circle cx="12" cy="5" r="2"/><path d="M8 15h.01M16 15h.01M8 19h8"/>
    </svg>
  ),
};

// ─── section title ─────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-orange-500 mb-4">
      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
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

// ─── card ──────────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-neutral-800 bg-[#18181b] p-6 ${className}`}>
      {children}
    </div>
  );
}

// ─── custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean; payload?: { name: string; value: number; fill?: string }[];
  label?: string; formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-neutral-700 bg-[#1c1c1e] px-4 py-3 shadow-2xl text-sm">
      {label && <p className="text-neutral-400 mb-1 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill ?? "#ff6a00" }} className="font-bold">
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── scroll helper ─────────────────────────────────────────────────────────────
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

// ─── SIMULATOR: RECEITA ───────────────────────────────────────────────────────
function SimuladorReceita() {
  const [clientes, setClientes] = useState(10);
  const [ticket, setTicket] = useState(3000);
  const [churnMensal, setChurnMensal] = useState(5);
  const [crescimento, setCrescimento] = useState(1);
  const [faturadoAte, setFaturadoAte] = useState(0);
  const [faturadoInput, setFaturadoInput] = useState("");

  const metaAnual = 2_500_000;
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const mesAtual = new Date().getMonth() + 1; // 1–12, mês corrente
  const mesesRealizados = mesAtual - 1; // meses já encerrados
  const labelRealizado = mesesRealizados > 0
    ? `Jan – ${nomes[mesesRealizados - 1]} · realizado`
    : "nenhum mês encerrado";

  const calcProjection = useCallback(() => {
    const months: { mes: string; realizado: number; projetado: number; clientes: number }[] = [];
    let clientesAtivos = clientes;
    let projetadoTotal = 0;
    const recMesRealizado = mesesRealizados > 0 && faturadoAte > 0 ? faturadoAte / mesesRealizados : 0;

    for (let i = 0; i < 12; i++) {
      const monthNum = i + 1;
      if (monthNum < mesAtual) {
        months.push({ mes: nomes[i], realizado: recMesRealizado, projetado: 0, clientes: 0 });
      } else {
        const churnSaem = Math.round(clientesAtivos * (churnMensal / 100));
        clientesAtivos = Math.max(0, clientesAtivos - churnSaem + crescimento);
        const rec = clientesAtivos * ticket;
        projetadoTotal += rec;
        months.push({ mes: nomes[i], realizado: 0, projetado: rec, clientes: clientesAtivos });
      }
    }
    return { months, projetadoTotal };
  }, [clientes, ticket, churnMensal, crescimento, faturadoAte, mesesRealizados]);

  const { months, projetadoTotal } = calcProjection();
  const totalAnual = faturadoAte + projetadoTotal;
  const batem = totalAnual >= metaAnual;
  const gap = totalAnual - metaAnual;

  function handleFaturadoChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setFaturadoInput(digits);
    setFaturadoAte(digits ? Number(digits) : 0);
  }

  return (
    <Card className="space-y-6">
      <div>
        <SectionLabel label="Simulador Interativo" />
        <h3 className="text-xl font-extrabold text-white mb-1">Projeção de Receita 2026</h3>
        <p className="text-neutral-400 text-sm">Informe o que já foi faturado e ajuste os parâmetros para ver o fechamento do ano.</p>
      </div>

      {/* Campo: faturado até agora */}
      <div className="rounded-xl border border-neutral-700 bg-neutral-900/70 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-white">Faturado até agora em 2026</label>
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 bg-neutral-800 rounded-full px-2 py-0.5">
            {labelRealizado}
          </span>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400 select-none">R$</span>
          <input
            type="text"
            inputMode="numeric"
            value={faturadoInput}
            onChange={(e) => handleFaturadoChange(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 pl-9 pr-4 py-2.5 text-base font-bold text-white placeholder:text-neutral-600 focus:border-orange-500/60 focus:outline-none transition-colors"
          />
        </div>
        <p className="text-xs text-neutral-600">A projeção a partir de Maio usa os parâmetros abaixo.</p>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {[
          { label: "Clientes atuais", value: clientes, set: setClientes, min: 1, max: 50, step: 1, fmt: (v: number) => `${v} clientes` },
          { label: "Ticket médio mensal", value: ticket, set: setTicket, min: 1000, max: 50000, step: 500, fmt: (v: number) => fmt(v, 0) },
          { label: "Churn mensal", value: churnMensal, set: setChurnMensal, min: 0, max: 20, step: 1, fmt: (v: number) => `${v}%` },
          { label: "Novos clientes/mês", value: crescimento, set: setCrescimento, min: 0, max: 10, step: 1, fmt: (v: number) => `+${v}/mês` },
        ].map(({ label, value, set, min, max, step, fmt: f }) => (
          <div key={label} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400 font-medium">{label}</span>
              <span className="text-orange-400 font-bold">{f(value)}</span>
            </div>
            <input
              type="range" min={min} max={max} step={step} value={value}
              onChange={(e) => set(Number(e.target.value))}
              className="w-full accent-orange-500 cursor-pointer"
            />
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={months} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff6a00" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ff6a00" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#525252" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="#525252" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="mes" tick={{ fill: "#666", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmt(v, 0)} tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmt(v, 0)} />} />
            <ReferenceLine y={metaAnual / 12} stroke="#ff6a00" strokeDasharray="4 4" strokeOpacity={0.5}
              label={{ value: "Meta mensal", position: "insideTopRight", fill: "#ff6a00", fontSize: 10 }} />
            <Area type="monotone" dataKey="realizado" name="Realizado" stroke="#6b7280" strokeWidth={2} fill="url(#gradReal)" />
            <Area type="monotone" dataKey="projetado" name="Projetado" stroke="#ff6a00" strokeWidth={2.5} fill="url(#gradRec)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Resultado */}
      <div className={`rounded-xl p-5 border ${batem ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-neutral-500 text-[10px] uppercase tracking-widest font-bold mb-1">Realizado</p>
            <p className="text-xl font-extrabold text-neutral-300">{fmt(faturadoAte, 2)}</p>
            <p className="text-[10px] text-neutral-600 mt-0.5">{mesesRealizados > 0 ? `Jan – ${nomes[mesesRealizados - 1]}` : "—"}</p>
          </div>
          <div>
            <p className="text-orange-400 text-[10px] uppercase tracking-widest font-bold mb-1">Projetado</p>
            <p className="text-xl font-extrabold text-orange-400">{fmt(projetadoTotal, 2)}</p>
            <p className="text-[10px] text-neutral-600 mt-0.5">{`${nomes[mesAtual - 1]} – Dez`}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-widest font-bold mb-1 ${batem ? "text-emerald-400" : "text-red-400"}`}>Total 2026</p>
            <p className={`text-xl font-extrabold ${batem ? "text-emerald-400" : "text-red-400"}`}>{fmt(totalAnual, 2)}</p>
            <p className="text-[10px] text-neutral-600 mt-0.5">vs meta R$ 2,5M</p>
          </div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <p className={`text-lg font-extrabold ${batem ? "text-emerald-400" : "text-red-400"}`}>
            {gap >= 0 ? "+" : ""}{fmt(Math.abs(gap), 2)}
          </p>
          <p className={`text-sm font-bold ${batem ? "text-emerald-500" : "text-red-500"}`}>
            {batem ? "✓ Meta atingida" : "✗ Abaixo da meta"}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ─── SIMULATOR: VGV ──────────────────────────────────────────────────────────
function SimuladorVGV() {
  const [vgv, setVgv] = useState(100);
  const [pctMkt, setPctMkt] = useState(1.5);
  const [pctCaptura, setPctCaptura] = useState(25);

  const budgetMkt = (vgv * 1_000_000 * pctMkt) / 100;
  const receita = budgetMkt * (pctCaptura / 100);

  const bars = [
    { name: "Budget total de mkt", value: budgetMkt, color: "#525252" },
    { name: "Sua participação", value: receita, color: "#ff6a00" },
  ];

  return (
    <Card className="space-y-6">
      <div>
        <SectionLabel label="Simulador VGV" />
        <h3 className="text-xl font-extrabold text-white mb-1">Quanto vale cada lançamento pra você?</h3>
        <p className="text-neutral-400 text-sm">No imobiliário, marketing representa 0,8–3% do VGV. Calcule sua fatia.</p>
      </div>

      <div className="space-y-5">
        {[
          { label: "VGV do empreendimento (R$ M)", value: vgv, set: setVgv, min: 10, max: 1000, step: 10, display: `R$ ${vgv}M` },
          { label: "% do VGV em marketing", value: pctMkt, set: setPctMkt, min: 0.5, max: 3, step: 0.1, display: pct(pctMkt) },
          { label: "Sua participação no budget de mkt", value: pctCaptura, set: setPctCaptura, min: 5, max: 100, step: 5, display: pct(pctCaptura) },
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

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => fmt(v, 0)} tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#aaa", fontSize: 11 }} axisLine={false} tickLine={false} width={130} />
            <Tooltip content={<ChartTooltip formatter={(v) => fmt(v, 2)} />} />
            <Bar dataKey="value" name="Valor" radius={[0, 6, 6, 0]}>
              {bars.map((b, i) => <Cell key={i} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-neutral-900 p-4 border border-neutral-800">
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-bold mb-1">Budget total de mkt</p>
          <p className="text-2xl font-extrabold text-white">{fmt(budgetMkt, 2)}</p>
        </div>
        <div className="rounded-xl bg-orange-500/10 p-4 border border-orange-500/30">
          <p className="text-orange-400 text-xs uppercase tracking-widest font-bold mb-1">Sua receita no projeto</p>
          <p className="text-2xl font-extrabold text-orange-400">{fmt(receita, 2)}</p>
        </div>
      </div>
    </Card>
  );
}

// ─── SIMULATOR: ICP ──────────────────────────────────────────────────────────
function SimuladorICP() {
  const [vgvAcima50, setVgvAcima50] = useState(true);
  const [pipelineAtivo, setPipelineAtivo] = useState(true);
  const [jaInvesteMarketing, setJaInvesteMarketing] = useState(true);
  const [dorVendas, setDorVendas] = useState(true);
  const [projetoUnico, setProjetoUnico] = useState(false);
  const [baixoOrcamento, setBaixoOrcamento] = useState(false);
  const [mentalidadeCusto, setMentalidadeCusto] = useState(false);

  const positivos = [vgvAcima50, pipelineAtivo, jaInvesteMarketing, dorVendas].filter(Boolean).length;
  const negativos = [projetoUnico, baixoOrcamento, mentalidadeCusto].filter(Boolean).length;
  const score = positivos * 25 - negativos * 20;
  const clamped = Math.max(0, Math.min(100, score));

  const label =
    clamped >= 80 ? { text: "Cliente ideal — prioridade máxima", color: "text-emerald-400", bar: "bg-emerald-500" } :
    clamped >= 50 ? { text: "Cliente potencial — qualificar melhor", color: "text-yellow-400", bar: "bg-yellow-500" } :
    { text: "Cliente ruim — vai te travar", color: "text-red-400", bar: "bg-red-500" };

  const Row = ({ label: l, checked, set, positive }: { label: string; checked: boolean; set: (v: boolean) => void; positive: boolean }) => (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => set(!checked)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer
          ${checked
            ? positive ? "bg-emerald-500 border-emerald-500" : "bg-red-500 border-red-500"
            : "border-neutral-600 bg-transparent"}`}
      >
        {checked && <Ico.Check c="w-3 h-3 text-white" />}
      </div>
      <span className={`text-sm transition-colors ${checked ? "text-white font-medium" : "text-neutral-400"}`}>{l}</span>
      <span className={`ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${positive ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"}`}>
        {positive ? "✓ positivo" : "✗ negativo"}
      </span>
    </label>
  );

  return (
    <Card className="space-y-6">
      <div>
        <SectionLabel label="Qualificador ICP" />
        <h3 className="text-xl font-extrabold text-white mb-1">Esse cliente vale seu tempo?</h3>
        <p className="text-neutral-400 text-sm">Marque as características do prospect e veja o score de fit instantaneamente.</p>
      </div>

      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Sinais positivos</p>
        <Row label="VGV acima de R$ 50M" checked={vgvAcima50} set={setVgvAcima50} positive />
        <Row label="Pipeline contínuo de lançamentos" checked={pipelineAtivo} set={setPipelineAtivo} positive />
        <Row label="Já investe em marketing" checked={jaInvesteMarketing} set={setJaInvesteMarketing} positive />
        <Row label="Tem dor em vendas (não só em lead)" checked={dorVendas} set={setDorVendas} positive />
        <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 pt-2">Sinais negativos</p>
        <Row label="Projeto único / one-shot" checked={projetoUnico} set={setProjetoUnico} positive={false} />
        <Row label="Baixo orçamento de marketing" checked={baixoOrcamento} set={setBaixoOrcamento} positive={false} />
        <Row label="Mentalidade de custo (não de investimento)" checked={mentalidadeCusto} set={setMentalidadeCusto} positive={false} />
      </div>

      <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-neutral-400 text-sm font-medium">Score de fit</span>
          <span className={`text-2xl font-extrabold ${label.color}`}>{clamped}/100</span>
        </div>
        <div className="h-2.5 rounded-full bg-neutral-800 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${label.bar}`} style={{ width: `${clamped}%` }} />
        </div>
        <p className={`text-sm font-bold ${label.color}`}>{label.text}</p>
      </div>
    </Card>
  );
}

const NAV_ITEMS = [
  { id: "mercado", label: "Mercado" },
  { id: "dinheiro", label: "Oportunidade" },
  { id: "posicionamento", label: "Posicionamento" },
  { id: "icp", label: "ICP" },
  { id: "mix-aquisicao", label: "Mix" },
  { id: "aquisicao", label: "Aquisição" },
  { id: "simuladores", label: "Simuladores" },
  { id: "meta", label: "Meta 2026" },
] as const;

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function InoutPlano2026() {
  const [activeSection, setActiveSection] = useState("");
  const navItems = NAV_ITEMS;

  useEffect(() => {
    const ids = NAV_ITEMS.map((n) => n.id);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveSection(e.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const metaMensal = 2_500_000 / 12;

  const marketData = [
    { name: "TAM", value: 1_750_000, label: "R$ 1,5–2 tri", sub: "Mercado total imobiliário" },
    { name: "SAM", value: 250_000, label: "R$ 200–300 bi", sub: "VGV de lançamentos ativos" },
    { name: "SOM", value: 4_750, label: "R$ 2–7,5 bi", sub: "Marketing de incorporadoras" },
    { name: "Sua meta", value: 2.5, label: "R$ 2,5M", sub: "Faturamento inout 2026" },
  ];

  // Score 0-100 composto: cada critério vale 0-25 (somando 100)
  // Tamanho: tamanho do mercado em VGV/ano
  // Pagamento: capacidade financeira média do segmento
  // Brecha: nível de concorrência (invertido — mais brecha = menos concorrência)
  // Urgência: pressão real do segmento por resultado em 2026
  const segmentoScore = [
    { name: "Médio/Alto padrão", tamanho: 22, pagamento: 24, brecha: 12, urgencia: 25, insight: "↑120% em lançamentos. Maior ticket, maior verba." },
    { name: "MCMV",              tamanho: 25, pagamento: 14, brecha: 10, urgencia: 18, insight: "Maior volume de vendas do mercado. Giro rápido." },
    { name: "Interior SP",       tamanho: 18, pagamento: 18, brecha: 22, urgencia: 16, insight: "R$ 12,7bi em VGV com pouca agência forte." },
    { name: "Tecnologia/IA",     tamanho: 14, pagamento: 22, brecha: 24, urgencia: 20, insight: "R$ 12bi impactados por IA. Diferencial defensável." },
  ].map((s) => ({ ...s, total: s.tamanho + s.pagamento + s.brecha + s.urgencia }));

  const quarterData = [
    { tri: "Q1", meta: 350_000, real: 0, label: "Base: 5–7 clientes, ticket R$15k" },
    { tri: "Q2", meta: 550_000, real: 0, label: "Escala: 8–10 clientes, ticket R$18k" },
    { tri: "Q3", meta: 750_000, real: 0, label: "Expansão: 11–13 clientes, ticket R$20k" },
    { tri: "Q4", meta: 850_000, real: 0, label: "Consolidação: 14–16 clientes, método próprio" },
  ];

  const alavancas = [
    { icon: <Ico.Target c="w-6 h-6" />, title: "CPL Qualificado", desc: "Reduzir custo por lead qualificado em 20%", impacto: "Alta" },
    { icon: <Ico.TrendingUp c="w-6 h-6" />, title: "Taxa de Agendamento", desc: "Aumentar agendamento pós-lead em 30%", impacto: "Alta" },
    { icon: <Ico.Zap c="w-6 h-6" />, title: "Conversão em Venda", desc: "Melhorar taxa de fechamento em 15%", impacto: "Crítica" },
  ];

  const icpSinais = [
    { ok: true, text: "VGV acima de R$ 50 milhões" },
    { ok: true, text: "Pipeline contínuo de lançamentos" },
    { ok: true, text: "Já investe em marketing" },
    { ok: true, text: "Dor em vendas — não só em leads" },
    { ok: false, text: "Projeto único / one-shot" },
    { ok: false, text: "Orçamento abaixo de R$ 5k/mês" },
    { ok: false, text: "Mentalidade de custo (não de investimento)" },
  ];

  const passos = [
    { num: "01", title: "Nichar forte e público", desc: "Especialistas em lançamento imobiliário — comunicação, site, cases, proposta: tudo fala imobiliário." },
    { num: "02", title: "Criar método proprietário", desc: "Não vendemos tráfego. Vendemos o Método de Velocidade de Venda Inout — com etapas mensuráveis e KPIs de VGV." },
    { num: "03", title: "Falar de dinheiro, não de marketing", desc: "Toda conversa começa em VGV, unidades/mês e conversão. Criativo e tráfego são ferramentas, não o produto." },
    { num: "04", title: "Entrar no comercial do cliente", desc: "Integração com CRM, follow-up estruturado, treinamento de corretores. Quem entra no comercial vira indispensável." },
    { num: "05", title: "Dashboards e previsibilidade", desc: "Clientes que veem dados ficam. Relatórios de lead→venda, custo por unidade vendida, ROI real de cada campanha." },
  ];

  return (
    <div className="-mx-4 -my-6 bg-[#0a0a0c] text-neutral-200 font-sans">

      {/* ── sticky nav ── */}
      <div className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0a0c]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-10 flex items-center justify-between h-14">
          <Link href="/planejamento" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Planejamento
          </Link>
          <nav className="hidden lg:flex gap-5 text-[13px] font-semibold text-neutral-400">
            {navItems.map((n) => (
              <button key={n.id} onClick={() => scrollTo(n.id)}
                className={`transition-colors hover:text-orange-500 ${activeSection === n.id ? "text-orange-500" : ""}`}>
                {n.label}
              </button>
            ))}
          </nav>
          <button onClick={() => scrollTo("simuladores")}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm transition-all shadow-lg shadow-orange-500/20">
            Simuladores →
          </button>
        </div>
      </div>

      {/* ── hero ── */}
      <section className="relative overflow-hidden border-b border-neutral-900 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="absolute inset-0 pointer-events-none">
          <svg className="absolute inset-0 w-full h-full opacity-10">
            <defs>
              <pattern id="g" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#333" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)" />
          </svg>
          <div className="absolute -right-40 -top-40 w-[600px] h-[600px] rounded-full bg-orange-500 opacity-[0.04] blur-[120px]" />
          <div className="absolute -left-20 bottom-0 w-80 h-80 rounded-full bg-orange-600 opacity-[0.03] blur-[80px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 md:px-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 text-orange-500 text-[11px] font-black uppercase tracking-[0.25em] mb-6">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Planejamento Inout 2026
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6">
              De agência<br />
              <span className="bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent">
                para alavanca
              </span>
              <br />de receita.
            </h1>

            <p className="text-lg md:text-xl text-neutral-400 max-w-2xl leading-relaxed mb-10">
              O mercado imobiliário movimenta <strong className="text-white">R$ 2–7,5 bilhões/ano em marketing</strong>.
              Quem domina marketing + vendas domina esse mercado. Este é o plano inout para 2026.
            </p>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => scrollTo("mercado")}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-xl shadow-orange-500/25 text-sm">
                Ver análise de mercado
              </button>
              <button onClick={() => scrollTo("simuladores")}
                className="border border-neutral-700 hover:border-orange-500/50 text-neutral-300 hover:text-white px-8 py-3 rounded-xl font-bold transition-all text-sm">
                Abrir simuladores
              </button>
            </div>

            <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { v: "R$ 2,5M", l: "Meta faturamento 2026" },
                { v: "R$ 250B", l: "SAM — VGV de lançamentos" },
                { v: "0,8–3%", l: "Do VGV vai para marketing" },
                { v: "20%", l: "Das incorporadoras = 80% VGV" },
              ].map(({ v, l }) => (
                <div key={l} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <p className="text-2xl font-extrabold text-orange-400 mb-1">{v}</p>
                  <p className="text-[11px] text-neutral-500 leading-snug">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── mercado: TAM/SAM/SOM ── */}
      <section id="mercado" className="py-24 border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="Tamanho do mercado" />
            <SectionTitle
              title={<>O dinheiro está aqui.<br />Onde você está?</>}
              sub="Do mercado total de R$ 1,5 tri à sua meta de R$ 2,5M — entenda em qual fatia do mercado você está operando e por quê isso muda tudo."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
            {marketData.map((m, i) => (
              <Card key={m.name} className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent pointer-events-none" style={{ opacity: 1 - i * 0.2 }} />
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-2">{m.name}</p>
                <p className="text-3xl font-extrabold text-white mb-1">{m.label}</p>
                <p className="text-sm text-neutral-400">{m.sub}</p>
                {i < 3 && (
                  <div className="mt-4 h-1.5 rounded-full bg-neutral-800">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: `${100 - i * 30}%` }} />
                  </div>
                )}
              </Card>
            ))}
          </div>

          <Card>
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <SectionLabel label="Insight crítico" />
                <h3 className="text-2xl font-extrabold text-white mb-4">Marketing = 0,8–3% do VGV</h3>
                <p className="text-neutral-400 mb-6 leading-relaxed">
                  Um empreendimento de <strong className="text-white">R$ 100M em VGV</strong> destina entre{" "}
                  <strong className="text-orange-400">R$ 800k e R$ 3M</strong> em marketing. Escale isso
                  para os R$ 250B de lançamentos anuais e você entende onde está o dinheiro.
                </p>
                <div className="space-y-3">
                  {[
                    { label: "R$ 50M VGV", mktMin: 400_000, mktMax: 1_500_000 },
                    { label: "R$ 100M VGV", mktMin: 800_000, mktMax: 3_000_000 },
                    { label: "R$ 300M VGV", mktMin: 2_400_000, mktMax: 9_000_000 },
                  ].map(({ label, mktMin, mktMax }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-sm text-neutral-400 w-28 shrink-0">{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-neutral-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-orange-500/60 to-orange-500"
                          style={{ width: `${(mktMax / 9_000_000) * 100}%` }} />
                      </div>
                      <span className="text-sm text-orange-400 font-bold w-36 text-right">
                        {fmt(mktMin, 1)} – {fmt(mktMax, 1)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-500 mt-4">Budget de marketing por empreendimento (faixa 0,8–3% do VGV)</p>
              </div>

              <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5 md:p-6 self-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-1">Regra 80/20 do VGV</p>
                <h4 className="text-base md:text-lg font-extrabold text-white mb-5 leading-tight">
                  Onde concentrar a energia comercial
                </h4>

                <div className="space-y-5">
                  {/* linha 1: empresas */}
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">% das incorporadoras</span>
                      <span className="text-xs text-neutral-400">100%</span>
                    </div>
                    <div className="flex h-9 rounded-lg overflow-hidden border border-neutral-800">
                      <div className="bg-orange-500 flex items-center justify-center text-white font-extrabold text-sm" style={{ width: "20%" }}>
                        20%
                      </div>
                      <div className="bg-neutral-800 flex items-center justify-center text-neutral-500 font-bold text-sm" style={{ width: "80%" }}>
                        80%
                      </div>
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] text-neutral-500">
                      <span className="text-orange-400 font-semibold">Top players</span>
                      <span>Long tail</span>
                    </div>
                  </div>

                  {/* linha 2: VGV */}
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">% do VGV total</span>
                      <span className="text-xs text-neutral-400">100%</span>
                    </div>
                    <div className="flex h-9 rounded-lg overflow-hidden border border-neutral-800">
                      <div className="bg-orange-500 flex items-center justify-center text-white font-extrabold text-sm" style={{ width: "80%" }}>
                        80%
                      </div>
                      <div className="bg-neutral-800 flex items-center justify-center text-neutral-500 font-bold text-sm" style={{ width: "20%" }}>
                        20%
                      </div>
                    </div>
                    <div className="flex justify-between mt-1.5 text-[10px] text-neutral-500">
                      <span className="text-orange-400 font-semibold">Concentrado nos grandes</span>
                      <span>Pulverizado</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-neutral-300 leading-snug">
                      <strong className="text-orange-400">20% das incorporadoras</strong> respondem por{" "}
                      <strong className="text-white">80% do VGV</strong> — atender 5 grandes vale mais que 50 pequenas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ── onde está o dinheiro ── */}
      <section id="dinheiro" className="py-24 border-b border-neutral-900 bg-[#0d0d0f]">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="Onde atacar" />
            <SectionTitle
              title="Onde o dinheiro está HOJE"
              sub="O mercado não está em crise — está ativo, competitivo e concentrado. Saiba exatamente onde focar energia em 2026."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {[
              {
                icon: <Ico.CityBuilding c="w-8 h-8 text-orange-400" />, iconBg: "bg-orange-400/10",
                badgeCls: "text-orange-400 bg-orange-400/10", ctaCls: "text-orange-500", checkCls: "text-orange-500",
                title: "Médio e Alto Padrão", cor: "from-orange-500/20 to-transparent", badge: "Maior margem",
                bullets: ["↑120% em lançamentos (Forbes)", "Ticket alto = mais verba de marketing", "Quem paga mais e exige mais resultado"],
                cta: "Alta prioridade"
              },
              {
                icon: <Ico.Home c="w-8 h-8 text-sky-400" />, iconBg: "bg-sky-400/10",
                badgeCls: "text-sky-400 bg-sky-400/10", ctaCls: "text-sky-400", checkCls: "text-sky-500",
                title: "MCMV", cor: "from-sky-500/15 to-transparent", badge: "Volume",
                bullets: ["Grande parte das vendas totais", "Incentivo governamental forte", "Giro rápido de estoque"],
                cta: "Operação escala"
              },
              {
                icon: <Ico.Leaf c="w-8 h-8 text-emerald-400" />, iconBg: "bg-emerald-400/10",
                badgeCls: "text-emerald-400 bg-emerald-400/10", ctaCls: "text-emerald-400", checkCls: "text-emerald-500",
                title: "Interior", cor: "from-emerald-600/15 to-transparent", badge: "Expansão",
                bullets: ["Interior SP: R$ 12,7B em VGV", "Menos concorrência de agências", "Custo de aquisição menor"],
                cta: "Oportunidade imediata"
              },
              {
                icon: <Ico.Bot c="w-8 h-8 text-violet-400" />, iconBg: "bg-violet-400/10",
                badgeCls: "text-violet-400 bg-violet-400/10", ctaCls: "text-violet-400", checkCls: "text-violet-500",
                title: "Tecnologia + IA", cor: "from-violet-600/15 to-transparent", badge: "Crescimento",
                bullets: ["R$ 12B em VGV impactado por IA", "Quem usa tech retém cliente", "Dashboards e automação = diferencial"],
                cta: "Diferencial competitivo"
              },
            ].map(({ icon, iconBg, badgeCls, ctaCls, checkCls, title, cor, badge, bullets, cta }) => (
              <Card key={title} className={`bg-gradient-to-b ${cor} relative`}>
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 ${iconBg}`}>{icon}</div>
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-extrabold text-white text-base">{title}</h4>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ml-2 shrink-0 ${badgeCls}`}>{badge}</span>
                </div>
                <ul className="space-y-2 mb-4">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-xs text-neutral-400">
                      <Ico.Check c={`w-3 h-3 mt-0.5 shrink-0 ${checkCls}`} />
                      {b}
                    </li>
                  ))}
                </ul>
                <span className={`text-[10px] font-black uppercase tracking-widest ${ctaCls}`}>{cta}</span>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <SectionLabel label="Índice de oportunidade" />
              <h3 className="text-lg font-extrabold text-white mb-1">Score de atratividade</h3>
              <p className="text-xs text-neutral-500 mb-6">
                Score 0–100 baseado em tamanho, capacidade de pagamento, brecha competitiva e urgência.
              </p>

              <div className="space-y-5">
                {[...segmentoScore].sort((a, b) => b.total - a.total).map((s) => {
                  const tierColor = s.total >= 80 ? "emerald" : s.total >= 70 ? "orange" : "amber";
                  const tierMap = {
                    emerald: { bar: "bg-emerald-500", text: "text-emerald-400" },
                    orange:  { bar: "bg-orange-500",  text: "text-orange-400" },
                    amber:   { bar: "bg-amber-500",   text: "text-amber-400" },
                  } as const;
                  const ts = tierMap[tierColor];
                  return (
                    <div key={s.name}>
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="font-bold text-white text-sm">{s.name}</p>
                        <p className={`text-xl font-extrabold tabular-nums ${ts.text}`}>
                          {s.total}<span className="text-xs text-neutral-600 font-normal">/100</span>
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                        <div className={`h-full ${ts.bar} rounded-full`} style={{ width: `${s.total}%` }} />
                      </div>
                      <p className="text-xs text-neutral-500 leading-snug mt-2">{s.insight}</p>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div>
                <SectionLabel label="Oportunidade escondida" />
                <h3 className="text-lg font-extrabold text-white mb-2">Estoque parado — a bomba silenciosa</h3>
                <p className="text-neutral-400 text-sm leading-relaxed mb-6">
                  Lançamentos de médio/alto padrão estão acumulando estoque porque as vendas não acompanham o ritmo de novos empreendimentos.
                  Isso gera <strong className="text-white">pressão absurda nas incorporadoras</strong> — e pressão gera verba.
                </p>
              </div>
              <div className="space-y-2.5">
                {[
                  "Incorporadoras vão precisar vender mais rápido",
                  "Queda no preço começa a ser cogitada — urgência real",
                  "Marketing + vendas viram investimento prioritário",
                  "Quem resolve esse problema primeiro ganha o contrato",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2 bg-orange-500/5 border border-orange-500/10 rounded-lg p-3">
                    <Ico.Zap c="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <span className="text-sm text-neutral-300">{t}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── posicionamento ── */}
      <section id="posicionamento" className="py-24 border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="Posicionamento" />
            <SectionTitle
              title="Mude o jogo mudando como você se apresenta"
              sub="A diferença entre disputar preço e participar de um mercado bilionário está em como você se posiciona — não no que você faz."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <Card className="border-red-500/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Ico.X c="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Posicionamento atual</p>
                  <p className="font-extrabold text-white">Agência de Marketing</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  "Disputa de preço com centenas de agências",
                  "Comparação direta e commoditização",
                  "Vende entregável: post, tráfego, criativo",
                  "Substituível a qualquer momento",
                  "Negociação baseada em custo mensal",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-3 text-sm text-neutral-400">
                    <Ico.X c="w-3.5 h-3.5 text-red-500 shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-emerald-500/20 relative overflow-hidden">
              <div className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                Objetivo 2026
              </div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Ico.TrendingUp c="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Posicionamento alvo</p>
                  <p className="font-extrabold text-white">Alavanca de Receita</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  "Conversa começa em VGV, não em orçamento",
                  "Indispensável: entra no comercial do cliente",
                  "Vende velocidade de venda e conversão",
                  "Contratos longos baseados em resultado",
                  "Participa do sucesso do lançamento",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-3 text-sm text-neutral-300">
                    <Ico.Check c="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="bg-gradient-to-r from-orange-500/10 to-transparent border-orange-500/30">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-3">A 3 alavancas que mudam o VGV</p>
                <h3 className="text-2xl font-extrabold text-white mb-2">Onde sua influência gera dinheiro real</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Quando você melhora essas 3 métricas juntas, o impacto no VGV do cliente é brutal —
                  e aí você justifica contratos grandes porque fala de negócio, não de marketing.
                </p>
              </div>
              <div className="space-y-4">
                {alavancas.map(({ icon, title, desc, impacto }) => (
                  <div key={title} className="flex items-start gap-4 bg-neutral-900/80 rounded-xl p-4 border border-neutral-800">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-white text-sm">{title}</p>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${impacto === "Crítica" ? "text-red-400 bg-red-400/10" : "text-orange-400 bg-orange-400/10"}`}>
                          {impacto}
                        </span>
                      </div>
                      <p className="text-neutral-400 text-xs mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* ── ICP ── */}
      <section id="icp" className="py-24 border-b border-neutral-900 bg-[#0d0d0f]">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="ICP — Perfil de cliente ideal" />
            <SectionTitle
              title="Pare de atender todo mundo"
              sub="O maior erro de agências em crescimento é tentar agradar qualquer cliente. Foco no ICP certo é o que separa R$ 500k de R$ 2,5M."
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {[
              {
                tipo: "Cliente Ideal", cor: "emerald", icone: <Ico.Check c="w-5 h-5" />,
                itens: icpSinais.filter(s => s.ok)
              },
              {
                tipo: "Cliente Ruim", cor: "red", icone: <Ico.X c="w-5 h-5" />,
                itens: icpSinais.filter(s => !s.ok)
              },
            ].map(({ tipo, cor, icone, itens }) => (
              <Card key={tipo} className={`border-${cor}-500/20`}>
                <div className={`flex items-center gap-3 mb-6`}>
                  <div className={`w-10 h-10 rounded-xl bg-${cor}-500/10 flex items-center justify-center text-${cor}-500`}>
                    {icone}
                  </div>
                  <p className={`font-extrabold text-white text-lg`}>{tipo}</p>
                </div>
                <div className="space-y-3">
                  {itens.map(({ text }) => (
                    <div key={text} className={`flex items-center gap-3 text-sm ${cor === "emerald" ? "text-neutral-300" : "text-neutral-400"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${cor === "emerald" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                        {cor === "emerald"
                          ? <Ico.Check c="w-3 h-3 text-emerald-500" />
                          : <Ico.X c="w-3 h-3 text-red-500" />}
                      </div>
                      {text}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="text-center mb-6">
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-2">Perfil completo do ICP</p>
              <h3 className="text-xl font-extrabold text-white">Incorporadora de médio/grande porte com dor em velocidade de venda</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: <Ico.Building c="w-5 h-5" />, label: "Porte", value: "VGV > R$ 50M por lançamento" },
                { icon: <Ico.TrendingUp c="w-5 h-5" />, label: "Pipeline", value: "2+ lançamentos/ano ativos" },
                { icon: <Ico.DollarSign c="w-5 h-5" />, label: "Budget", value: "R$ 800k–3M em marketing/proj." },
                { icon: <Ico.Target c="w-5 h-5" />, label: "Dor real", value: "Velocidade de venda e conversão" },
              ].map(({ icon, label, value }) => (
                <div key={label} className="rounded-xl bg-neutral-900 border border-neutral-800 p-4">
                  <div className="text-orange-500 mb-2">{icon}</div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white leading-snug">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ── mix de aquisição (3 canais) ── */}
      <section id="mix-aquisicao" className="py-24 border-b border-neutral-900 bg-[#0d0d0f]">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="Mix de aquisição" />
            <SectionTitle
              title={<>Inbound não chega no <span className="bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent">Tipo 3</span> sozinho.</>}
              sub="A meta de R$ 2,5M depende dos clientes grandes — e clientes grandes não preenchem formulário. Aqui está o mix completo de canais que efetivamente abre essas portas."
            />
          </div>
          <MixAquisicao />
        </div>
      </section>

      {/* ── aquisição qualificada (nova) ── */}
      <section id="aquisicao" className="py-24 border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="Aquisição qualificada" />
            <SectionTitle
              title={<>Não precisamos de mais leads.<br />Precisamos dos <span className="bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent">leads certos.</span></>}
              sub="Estratégia profunda de unit economics, funil correto em 3 camadas, formulário inteligente com scoring automático e oferta dupla para monetizar quem hoje viraria descarte."
            />
          </div>
          <AquisicaoQualificada />
        </div>
      </section>

      {/* ── simuladores ── */}
      <section id="simuladores" className="py-24 border-b border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="Ferramentas interativas" />
            <SectionTitle
              title="Simule. Ajuste. Decida."
              sub="Use os simuladores abaixo para testar cenários de receita, calcular o valor de cada empreendimento e qualificar prospects em tempo real."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SimuladorReceita />
            </div>
            <div>
              <SimuladorVGV />
            </div>
            <div className="lg:col-span-3">
              <SimuladorICP />
            </div>
          </div>
        </div>
      </section>

      {/* ── meta 2026 ── */}
      <section id="meta" className="py-24 border-b border-neutral-900 bg-[#0d0d0f]">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="Meta 2026" />
            <SectionTitle
              title={<>R$ 2,5M. Trimestre a trimestre.</>}
              sub="Breakdown da meta anual em metas trimestrais realistas, com o perfil de carteira necessário em cada fase."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <Card>
              <p className="text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-4">Meta acumulada por trimestre</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={quarterData.map((q, i) => ({
                      ...q,
                      acumulado: quarterData.slice(0, i + 1).reduce((s, x) => s + x.meta, 0),
                    }))}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="tri" tick={{ fill: "#666", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmt(v, 1)} tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} width={68} />
                    <Tooltip contentStyle={{ background: "#1c1c1e", border: "1px solid #333", borderRadius: 12, fontSize: 12, color: "#e5e5e5" }} itemStyle={{ color: "#e5e5e5" }} labelStyle={{ color: "#999" }} formatter={(v) => [fmt(v as number, 2), "Acumulado"]} />
                    <ReferenceLine y={2_500_000} stroke="#ff6a00" strokeDasharray="4 4"
                      label={{ value: "Meta R$ 2,5M", position: "insideTopRight", fill: "#ff6a00", fontSize: 11 }} />
                    <Bar dataKey="acumulado" name="Acumulado" fill="#ff6a00" radius={[6, 6, 0, 0]}>
                      {quarterData.map((_, i) => <Cell key={i} fill={`rgba(255,106,0,${0.4 + i * 0.2})`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="space-y-3">
              {quarterData.map((q) => (
                <Card key={q.tri} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-full">{q.tri}</span>
                      <span className="font-bold text-white">{fmt(q.meta, 2)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400">{q.label}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-neutral-800">
                    <div className="h-full rounded-full bg-orange-500/70" style={{ width: `${(q.meta / 850_000) * 100}%` }} />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Clientes alvo no final do ano", value: "14–16", sub: "incorporadoras ICP" },
              { label: "Ticket médio mensal alvo", value: "R$ 18–20k", sub: "por cliente" },
              { label: "Churn máximo tolerado", value: "< 5%/mês", sub: "para bater a meta" },
              { label: "Novos clientes necessários", value: "~2/mês", sub: "a partir do Q2" },
            ].map(({ label, value, sub }) => (
              <Card key={label} className="text-center">
                <p className="text-2xl font-extrabold text-orange-400 mb-1">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-0.5">{label}</p>
                <p className="text-xs text-neutral-600">{sub}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── plano de ação ── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-10">
          <div className="text-center mb-14">
            <SectionLabel label="Plano de ação" />
            <SectionTitle
              title="5 movimentos para dominar o nicho"
              sub="A estratégia é clara. A execução é o que separa quem fala de quem fatura."
            />
          </div>

          <div className="space-y-4 mb-14">
            {passos.map(({ num, title, desc }) => (
              <div key={num} className="flex gap-6 items-start group">
                <div className="shrink-0 w-12 h-12 rounded-xl border border-orange-500/30 bg-orange-500/5 flex items-center justify-center">
                  <span className="text-orange-500 font-extrabold text-sm">{num}</span>
                </div>
                <Card className="flex-1 p-5 group-hover:border-orange-500/30 transition-colors">
                  <h4 className="font-extrabold text-white mb-1.5">{title}</h4>
                  <p className="text-neutral-400 text-sm leading-relaxed">{desc}</p>
                </Card>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-8 md:p-12 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-4">O insight mais importante</p>
            <blockquote className="text-2xl md:text-4xl font-extrabold text-white leading-tight mb-6 max-w-3xl mx-auto">
              &ldquo;O mercado não precisa de mais marketing.
              <br />
              <span className="text-orange-400">Ele precisa vender mais rápido.</span>&rdquo;
            </blockquote>
            <p className="text-neutral-400 max-w-xl mx-auto mb-8">
              Quem resolve velocidade de venda não disputa preço. Participa do VGV.
              Esse é o reposicionamento que leva a inout ao faturamento de R$ 2,5M em 2026.
            </p>
            <button onClick={() => scrollTo("simuladores")}
              className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-4 rounded-xl font-extrabold text-base transition-all shadow-2xl shadow-orange-500/30">
              Simular minha meta agora →
            </button>
          </div>
        </div>
      </section>

      {/* ── footer ── */}
      <div className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600">
        Planejamento Inout 2026 — Confidencial — Mercado Imobiliário
      </div>
    </div>
  );
}
