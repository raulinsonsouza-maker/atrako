"use client";

import React from "react";
import Link from "next/link";

const O = "#ff6a00";
const OS = "#ff9a40";
const OD = "rgba(255,106,0,0.10)";
const OB = "rgba(255,106,0,0.22)";
const G = "#10b981";
const GD = "rgba(16,185,129,0.08)";
const GB = "rgba(16,185,129,0.22)";

function Check() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const SERVICOS = [
  "Gestão completa de Meta Ads e Google Ads",
  "Estratégia de mídia e distribuição de verba entre empreendimentos",
  "Implementação e gestão de CRM com funil de vendas estruturado",
  "Integração e alinhamento contínuo com a equipe comercial",
  "Rastreamento de leads do primeiro clique até a venda assinada",
  "Relatórios mensais de performance e reunião quinzenal de alinhamento",
];

const TERMOS = [
  { label: "Investimento em mídia", value: "R$ 8.000/mês", sub: "Pago diretamente nas plataformas — Meta e Google" },
  { label: "Fee de operação", value: "R$ 2.000/mês", sub: "Garante equipe dedicada e operação com foco total no projeto" },
  { label: "Participação nos resultados", value: "1% do VGV", sub: "Compartilhamos o crescimento — sobre todas as vendas do período" },
  { label: "Vigência", value: "12 meses", sub: "Tempo real para estruturar, crescer e colher resultado" },
  { label: "Revisão conjunta", value: "90 dias", sub: "Ajustamos juntos o que precisar — escopo, estratégia e ritmo" },
];

export default function PropostaHibrido() {
  return (
    <main className="min-h-screen pb-16">

      {/* back */}
      <div className="mb-8">
        <Link href="/planejamento" className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Planejamento
        </Link>
      </div>

      {/* ── FOLD 1 ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* hero */}
        <div className="relative overflow-hidden rounded-3xl border p-8 flex flex-col justify-between min-h-[420px]"
          style={{ borderColor: OB, background: "linear-gradient(145deg, #111113 0%, #0d0d10 100%)" }}>
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-10 blur-3xl" style={{ background: O }} />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full opacity-5 blur-3xl" style={{ background: O }} />

          <div className="relative space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: O }}>
              Proposta · Modelo Híbrido
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.1] text-white">
              Parceria com<br />
              <span style={{ color: OS }}>custo compartilhado</span>
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed max-w-xs">
              Estruturamos juntos a operação de marketing, funil e CRM. Você foca em vender e entregar — nós cuidamos de atrair, qualificar e medir. O crescimento de um impulsiona o outro.
            </p>
          </div>

          <div className="relative mt-8 flex items-end gap-8">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Fee mensal</p>
              <p className="text-5xl font-black text-white">R$ 2k</p>
            </div>
            <div className="pb-1">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">+ comissão</p>
              <p className="text-3xl font-extrabold" style={{ color: OS }}>1% VGV</p>
            </div>
          </div>
        </div>

        {/* servicos */}
        <div className="rounded-3xl border border-neutral-800 bg-[#111113] p-8">
          <p className="text-[11px] uppercase tracking-widest font-black text-neutral-500 mb-6">O que entregamos</p>
          <ul className="space-y-4">
            {SERVICOS.map((s) => (
              <li key={s} className="flex items-start gap-3">
                <Check />
                <span className="text-[15px] text-neutral-200 leading-snug">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FOLD 2 ── */}

      {/* como funciona */}
      <section className="rounded-3xl border border-neutral-800 bg-[#111113] p-8 mb-6">
        <p className="text-[11px] uppercase tracking-widest font-black text-neutral-500 mb-6">Como funciona</p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            {
              n: "01",
              titulo: "Estrutura e CRM",
              texto: "Primeira semana: configuramos o CRM, mapeamos o funil e integramos com a equipe comercial. Nenhum anúncio no ar antes do processo estar pronto.",
            },
            {
              n: "02",
              titulo: "Mídia e otimização",
              texto: "Meta Ads e Google Ads rodando com verba de R$ 8k/mês. Estratégia, criativos e distribuição definidos pela agência — otimização contínua ao longo do mês.",
            },
            {
              n: "03",
              titulo: "Crescimento compartilhado",
              texto: "A participação de 1% sobre as vendas do período é o que mantém agência e construtora com os mesmos objetivos. Crescemos juntos — quanto mais imóveis vendidos, mais forte fica a parceria.",
            },
          ].map(({ n, titulo, texto }) => (
            <div key={n} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-black" style={{ color: OD.replace("0.10", "0.4") }}>
                  <span className="text-lg font-black" style={{ color: O }}>{n}</span>
                </span>
                <div className="h-px flex-1 bg-neutral-800" />
              </div>
              <p className="text-base font-bold text-white">{titulo}</p>
              <p className="text-sm text-neutral-400 leading-relaxed">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* termos */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-6">
        {TERMOS.map(({ label, value, sub }) => (
          <div key={label} className="rounded-2xl border border-neutral-800 bg-[#111113] p-5 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">{label}</p>
            <p className="text-xl font-extrabold text-white leading-tight">{value}</p>
            <p className="text-xs text-neutral-600 leading-snug">{sub}</p>
          </div>
        ))}
      </section>

      {/* fechamento */}
      <section className="rounded-3xl p-8 space-y-3" style={{ background: GD, border: `1px solid ${GB}` }}>
        <p className="text-[11px] uppercase tracking-widest font-black" style={{ color: G }}>
          Por que essa estrutura funciona
        </p>
        <p className="text-base text-neutral-200 leading-relaxed max-w-2xl">
          O fee de operação garante que a equipe esteja dedicada ao projeto com a atenção que ele merece. A participação nos resultados garante que nossos objetivos sejam idênticos aos seus: vender mais, crescer juntos e construir algo duradouro. Em 90 dias revisamos tudo juntos — o que estiver funcionando a gente acelera, o que precisar mudar a gente ajusta.
        </p>
      </section>

    </main>
  );
}
