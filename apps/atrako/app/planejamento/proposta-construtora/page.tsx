"use client";

import React from "react";
import Link from "next/link";

const RED = "#ff6a00";
const RED_SOFT = "#ff9a40";
const RED_DIM = "rgba(255,106,0,0.10)";
const RED_BORDER = "rgba(255,106,0,0.22)";
const GREEN = "#10b981";
const GREEN_DIM = "rgba(16,185,129,0.08)";
const GREEN_BORDER = "rgba(16,185,129,0.22)";

function SectionLabel({ label, color = RED }: { label: string; color?: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] mb-3" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {label}
    </p>
  );
}

function Tag({ children, color = RED }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}
    >
      {children}
    </span>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-neutral-300 leading-snug">
      <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {children}
    </li>
  );
}

function AlertItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-neutral-400 leading-snug">
      <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke={RED_SOFT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      {children}
    </li>
  );
}

function LockItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-neutral-300 leading-snug">
      <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {children}
    </li>
  );
}

const EMPREENDIMENTOS = [
  { nome: "Luminare", unidades: 10, valorUnit: 480_000, status: "Estoque parado", cor: "#f59e0b" },
  { nome: "Kantoo", unidades: 48, valorUnit: 700_000, status: "Em andamento", cor: "#60a5fa" },
  { nome: "Sarandi", unidades: 240, valorUnit: 460_000, status: "Lançamento iminente", cor: GREEN },
];

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

export default function PropostaConstrutora() {
  return (
    <main className="space-y-8 pb-16">

      {/* ── Header ── */}
      <section className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-[linear-gradient(160deg,rgba(22,23,28,0.99)_0%,rgba(12,12,16,1)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#ff6a00] opacity-[0.05] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-[#ff6a00] opacity-[0.03] blur-3xl" />
        <div className="relative px-8 pb-8 pt-8 sm:px-10 sm:pt-10">
          <div className="mb-3">
            <Link href="/planejamento" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
              </svg>
              Planejamento
            </Link>
          </div>
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ color: RED }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: RED }} />
            Análise interna · Uso restrito
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            <span className="text-white">Análise dos Modelos </span>
            <span className="bg-gradient-to-r from-[#ff6a00] to-[#ff9a40] bg-clip-text text-transparent">
              Construtora
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-400">
            Comparativo interno dos dois modelos propostos — Híbrido e Performance — com análise financeira, riscos e contexto para a call.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Tag color={RED}>Luminare · Kantoo · Sarandi</Tag>
            <Tag color="#60a5fa">Maringá – PR</Tag>
            <Tag color={GREEN}>VGV Total R$ 148,8M</Tag>
            <Tag color="#a78bfa">Somente interno</Tag>
          </div>

          {/* links para as propostas */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/planejamento/proposta-construtora-hibrido"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all"
              style={{ background: RED_DIM, border: `1px solid ${RED_BORDER}`, color: RED_SOFT }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              Ver Proposta Híbrido
            </Link>
            <Link href="/planejamento/proposta-construtora-performance"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all"
              style={{ background: "rgba(16,185,129,0.08)", border: `1px solid rgba(16,185,129,0.22)`, color: GREEN }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              Ver Proposta Performance
            </Link>
          </div>
        </div>
      </section>

      {/* ── Empreendimentos ── */}
      <section className="space-y-4">
        <SectionLabel label="Empreendimentos contemplados" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {EMPREENDIMENTOS.map((e) => {
            const vgv = e.unidades * e.valorUnit;
            const pctVgv = (vgv / 148_800_000) * 100;
            const comissao = vgv * 0.01;
            return (
              <div key={e.nome} className="rounded-2xl border border-neutral-800 bg-[#18181b] p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-extrabold text-white">{e.nome}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{e.unidades} unidades · {fmtBRL(e.valorUnit)} cada</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: `${e.cor}18`, border: `1px solid ${e.cor}30`, color: e.cor }}>
                    {e.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pctVgv}%`, background: e.cor }} />
                  </div>
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>VGV {fmtBRL(vgv)}</span>
                    <span>{pctVgv.toFixed(0)}% do total</span>
                  </div>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: RED_DIM, border: `1px solid ${RED_BORDER}` }}>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 mb-0.5">Comissão 1% (venda total)</p>
                  <p className="text-xl font-extrabold" style={{ color: RED_SOFT }}>{fmtBRL(comissao)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="rounded-2xl border border-neutral-800 bg-[#18181b] p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">VGV Total</p>
              <p className="text-2xl font-extrabold text-white">R$ 148,8M</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">Unidades</p>
              <p className="text-2xl font-extrabold text-white">298</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">Investimento mídia/mês</p>
              <p className="text-2xl font-extrabold text-white">R$ 8k</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">Comissão total (1% VGV)</p>
              <p className="text-2xl font-extrabold" style={{ color: RED_SOFT }}>R$ 1,488M</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Propostas lado a lado ── */}
      <section className="space-y-4">
        <SectionLabel label="Comparativo dos modelos" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* Modelo A */}
          <div className="rounded-2xl border border-neutral-700 bg-[#18181b] flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-5 border-b border-neutral-800">
              <div className="flex items-start justify-between mb-3">
                <Tag color="#a78bfa">Modelo A</Tag>
                <Tag color="#60a5fa">Recomendado</Tag>
              </div>
              <h2 className="text-2xl font-extrabold text-white">Híbrido</h2>
              <p className="text-sm text-neutral-400 mt-1">Fee fixo + performance sobre VGV</p>
              <div className="mt-5 flex items-end gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-0.5">Fee mensal</p>
                  <p className="text-4xl font-extrabold text-white">R$ 2.000</p>
                  <p className="text-xs text-neutral-500 mt-0.5">+ 1% sobre VGV das vendas atribuídas</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-5 flex-1">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-3">Lógica financeira</p>
                <div className="space-y-2">
                  {[
                    { label: "Custo anual máximo (fee)", value: "R$ 24.000" },
                    { label: "Comissão se vender apenas Sarandi", value: "R$ 1.104.000" },
                    { label: "Comissão sobre VGV total", value: "R$ 1.488.000" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center text-sm">
                      <span className="text-neutral-400">{label}</span>
                      <span className="font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.18)" }}>
                <p className="text-xs font-bold text-[#a78bfa] uppercase tracking-widest mb-1">Por que faz sentido</p>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Distribui risco entre as partes. Agência garante custo mínimo; cliente garante skin in the game desde o dia 1.
                </p>
              </div>
            </div>
          </div>

          {/* Modelo B */}
          <div className="rounded-2xl border flex flex-col overflow-hidden" style={{ borderColor: RED_BORDER, background: "#18181b" }}>
            <div className="px-6 pt-6 pb-5 border-b" style={{ borderColor: "rgba(255,106,0,0.12)" }}>
              <div className="flex items-start justify-between mb-3">
                <Tag color={RED}>Modelo B</Tag>
                <Tag color="#f59e0b">Risco maior p/ agência</Tag>
              </div>
              <h2 className="text-2xl font-extrabold text-white">Performance</h2>
              <p className="text-sm text-neutral-400 mt-1">Zero fee · 100% orientado a resultado</p>
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-0.5">Fee mensal</p>
                <p className="text-4xl font-extrabold" style={{ color: RED }}>R$ 0</p>
                <p className="text-xs text-neutral-500 mt-0.5">+ 1% sobre VGV das vendas atribuídas</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-5 flex-1">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-neutral-500 mb-3">Lógica financeira</p>
                <div className="space-y-2">
                  {[
                    { label: "Custo anual para o cliente (fee)", value: "R$ 0" },
                    { label: "Comissão se vender apenas Sarandi", value: "R$ 1.104.000" },
                    { label: "Comissão sobre VGV total", value: "R$ 1.488.000" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center text-sm">
                      <span className="text-neutral-400">{label}</span>
                      <span className="font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: RED_DIM, border: `1px solid ${RED_BORDER}` }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: RED }}>O risco real</p>
                <p className="text-sm text-neutral-300 leading-relaxed">
                  Agência investe operação sem receita garantida. Exige processo de CRM seguido à risca pelo cliente. Se as vendas saírem do funil, comissão não é devida.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Termos não negociáveis ── */}
      <section className="space-y-4">
        <SectionLabel label="Termos não negociáveis — válidos nos dois modelos" color="#a78bfa" />
        <div className="rounded-2xl border border-neutral-800 bg-[#18181b] p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-bold text-white">Atribuição de vendas</p>
              <ul className="space-y-2.5">
                <LockItem>Somente leads dos canais gerenciados e registrados no CRM contam para comissão</LockItem>
                <LockItem>Vendas por WhatsApp direto, indicação ou canal próprio sem registro no CRM não geram comissão</LockItem>
                <LockItem>CRM e onboarding da equipe na primeira semana — sem negociação</LockItem>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-bold text-white">Processo e transparência</p>
              <ul className="space-y-2.5">
                <LockItem>Registro obrigatório de todos os atendimentos no CRM — sem exceção</LockItem>
                <LockItem>Reunião quinzenal com time comercial e dados de performance</LockItem>
                <LockItem>Acesso completo às plataformas de mídia para acompanhamento</LockItem>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparativo rápido ── */}
      <section className="space-y-4">
        <SectionLabel label="Comparativo direto" />
        <div className="rounded-2xl border border-neutral-800 bg-[#18181b] overflow-hidden">
          <div className="grid grid-cols-3 text-xs font-bold uppercase tracking-widest text-neutral-500 px-6 py-3 border-b border-neutral-800">
            <span>Critério</span>
            <span className="text-center text-[#a78bfa]">Modelo A — Híbrido</span>
            <span className="text-center" style={{ color: RED }}>Modelo B — Performance</span>
          </div>
          {[
            ["Fee mensal", "R$ 2.000", "R$ 0"],
            ["Comissão", "1% do VGV atribuído", "1% do VGV atribuído"],
            ["Risco da agência", "Baixo", "Alto"],
            ["Risco do cliente", "Baixo", "Zero custo fixo"],
            ["Previsibilidade", "Sim — fee garante operação", "Não — 100% variável"],
            ["Comprometimento exigido", "Equilibrado", "Máximo do cliente"],
            ["Revisão", "90 dias", "90 dias"],
            ["Vigência mínima", "12 meses", "12 meses"],
          ].map(([criterio, a, b], i) => (
            <div key={i} className={`grid grid-cols-3 px-6 py-3.5 text-sm ${i % 2 === 0 ? "bg-white/[0.015]" : ""} border-b border-neutral-800/50 last:border-0`}>
              <span className="text-neutral-400 font-medium">{criterio}</span>
              <span className="text-center text-white font-semibold">{a}</span>
              <span className="text-center font-semibold" style={{ color: RED_SOFT }}>{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contexto para a call ── */}
      <section className="space-y-4">
        <SectionLabel label="Contexto para a call" color={GREEN} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl p-5 space-y-3" style={{ background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}` }}>
            <p className="text-sm font-bold text-white">O que favorece a parceria</p>
            <ul className="space-y-2.5">
              <CheckItem>Faturamento acima de R$ 1M/mês mesmo sem processo definido — já tem tração</CheckItem>
              <CheckItem>Sarandi com 240 unidades em lançamento iminente — janela crítica de marketing</CheckItem>
              <CheckItem>Criativos já produzidos por profissional que atende a conta — custo incremental baixo</CheckItem>
              <CheckItem>Cliente com corredor de vendas próprio — agência estrutura, não substitui</CheckItem>
            </ul>
          </div>
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <p className="text-sm font-bold text-white">O que precisa ficar claro na call</p>
            <ul className="space-y-2.5">
              <AlertItem>Vendas fora do CRM não são atribuíveis — regra inegociável nos dois modelos</AlertItem>
              <AlertItem>Dono e corretor precisam registrar todos os contatos no processo</AlertItem>
              <AlertItem>Modelo B exige comprometimento total com o CRM para proteger a agência</AlertItem>
              <AlertItem>Revisão de 90 dias existe para ajustar escopo se o volume crescer</AlertItem>
            </ul>
          </div>
        </div>
      </section>

    </main>
  );
}
