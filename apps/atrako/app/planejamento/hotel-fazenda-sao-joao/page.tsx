"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const IconTarget = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
  </svg>
);

const IconChart = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const IconFilter = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

const IconLayers = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/>
  </svg>
);

const IconCheck = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const SectionTitle = ({ title, subtitle, centered = true }: { title: string; subtitle?: string; centered?: boolean }) => (
  <div className={`mb-12 ${centered ? "text-center" : "text-left"}`}>
    <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">{title}</h2>
    {subtitle && <p className="text-lg text-neutral-400 max-w-3xl mx-auto">{subtitle}</p>}
  </div>
);

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

export default function HotelFazendaSaoJoaoPlanoPage() {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const sections = ["diagnostico", "estrutura", "orcamento", "kpis"];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const navItems = [
    { id: "diagnostico", label: "Diagnóstico" },
    { id: "estrutura", label: "Estrutura" },
    { id: "orcamento", label: "Orçamento" },
    { id: "kpis", label: "Roadmap" },
  ];

  return (
    <div className="-mx-4 -my-6 bg-[#0f0f0f] text-neutral-200">

      {/* Sticky sub-nav */}
      <div className="sticky top-0 z-40 border-b border-neutral-800 bg-[#111111]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-14">
          <Link
            href="/planejamento"
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Planejamento
          </Link>
          <nav className="hidden md:flex gap-6 text-sm font-semibold text-neutral-400">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`transition-colors hover:text-orange-500 ${activeSection === item.id ? "text-orange-500" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => scrollToSection("orcamento")}
            className="bg-orange-500 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 text-sm"
          >
            Ver Setup
          </button>
        </div>
      </div>

      {/* Hero */}
      <section className="relative pt-20 pb-20 md:pt-28 md:pb-28 overflow-hidden border-b border-neutral-900">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <svg className="absolute left-0 top-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#333333" strokeWidth="1" opacity="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
          <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-orange-500/5 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          <div className="bg-[#18181b] border border-neutral-800 rounded-2xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-orange-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="max-w-4xl relative z-10">
              <div className="inline-flex items-center gap-2 text-orange-500 text-xs font-black uppercase tracking-widest mb-6">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Projeto de Performance Estratégica
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight mb-6 tracking-tight">
                Hotel Fazenda São João<br />
                <span className="text-orange-500">Máquina de Aquisição</span>
              </h1>
              <p className="text-lg md:text-xl text-neutral-400 mb-10 leading-relaxed max-w-2xl">
                Plano tático inout para resolver a fragmentação da conta Meta Ads, escalar o topo de funil e garantir previsibilidade de vendas diretas com R$ 1.050/dia.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 bg-[#111] p-2 rounded-xl border border-neutral-800 w-fit">
                <button
                  onClick={() => scrollToSection("diagnostico")}
                  className="bg-orange-500 text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                >
                  Analisar Funil
                </button>
                <button
                  onClick={() => scrollToSection("estrutura")}
                  className="bg-transparent text-neutral-400 px-8 py-3 rounded-lg font-bold hover:bg-neutral-800 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <IconLayers className="w-5 h-5" />
                  Arquitetura
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Diagnóstico */}
      <section id="diagnostico" className="py-24 bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <SectionTitle
            title="Auditoria da Conta Atual"
            subtitle="Por que nossa escala está travada? Análise baseada nos dados dos últimos 30 dias."
          />
          <div className="grid md:grid-cols-2 gap-8 mt-16">
            <div className="p-8 rounded-2xl bg-[#18181b] border border-neutral-800 shadow-sm transition-all hover:border-neutral-700">
              <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-6 text-red-500">
                <IconFilter className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-white">O Problema de Estrutura</h3>
              <p className="text-neutral-400 leading-relaxed mb-6">
                Hoje a conta possui <strong>23 conjuntos de anúncios</strong> rodando simultaneamente. Isso pulveriza a verba, força campanhas a entrarem em &quot;Aprendizado Limitado&quot; e eleva o CPA em públicos abertos (chegando a R$ 658/compra).
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-neutral-300">
                  <span className="text-red-500 font-bold mt-0.5">✕</span>
                  <span>Verba fragmentada (o algoritmo não aprende).</span>
                </li>
                <li className="flex items-start gap-3 text-neutral-300">
                  <span className="text-red-500 font-bold mt-0.5">✕</span>
                  <span>Lookalikes (LAL) fracos sem volume de conversão.</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-2xl bg-[#18181b] border border-orange-500/20 shadow-sm relative overflow-hidden transition-all hover:border-orange-500/40">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-6 text-white shadow-lg shadow-orange-500/20">
                  <IconTarget className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">A Oportunidade (Validada)</h3>
                <p className="text-neutral-400 leading-relaxed mb-6">
                  Nosso Fundo de Funil é eficiente. O Remarketing de <em>Initiate Checkout</em> traz vendas a <strong>R$ 87,71</strong>. No entanto, não podemos escalar apenas o Remarketing sem injetar tráfego novo através de um topo de funil forte.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-neutral-300">
                    <IconCheck className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <span>Base quente responde muito bem a ofertas (VOLTEI10).</span>
                  </li>
                  <li className="flex items-start gap-3 text-neutral-300">
                    <IconCheck className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                    <span>Solução: Criar um Topo de Funil forte para alimentar o Remarketing.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Estrutura */}
      <section id="estrutura" className="py-24 bg-[#111111] border-y border-neutral-900">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <SectionTitle
            title="A Nova Arquitetura de Funil"
            subtitle="Redução de 23 conjuntos para 4 campanhas consolidadas. Foco na previsibilidade inout."
          />
          <div className="grid md:grid-cols-4 gap-6 mt-16">
            <div className="bg-[#18181b] border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col h-full hover:border-neutral-700 transition-colors relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-neutral-600" />
              <h3 className="text-xl font-bold mb-1 text-white mt-2">1. Prospecção</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 block">Topo (55%)</span>
              <p className="text-neutral-400 text-sm mb-6 flex-grow">
                Foco em volume qualificado usando inteligência IA (Broad). Sem segmentações ultra-fechadas.
              </p>
              <div className="bg-[#111] border border-neutral-800 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center"><span className="text-neutral-400">Broad (Aberto)</span><span className="font-bold text-white">R$ 300</span></div>
                <div className="flex justify-between items-center"><span className="text-neutral-400">Lookalike</span><span className="font-bold text-white">R$ 150</span></div>
                <div className="flex justify-between items-center"><span className="text-neutral-400">Interesses</span><span className="font-bold text-white">R$ 100</span></div>
              </div>
            </div>

            <div className="bg-[#18181b] border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col h-full hover:border-neutral-700 transition-colors relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-neutral-500" />
              <h3 className="text-xl font-bold mb-1 text-white mt-2">2. Consideração</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 block">Meio (25%)</span>
              <p className="text-neutral-400 text-sm mb-6 flex-grow">
                Campanha única para nutrir quem já interagiu. Consolidação de todos os públicos quentes.
              </p>
              <div className="bg-[#111] border border-neutral-800 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center"><span className="text-neutral-400">Engajamento 180D</span><span className="font-bold text-white">Único</span></div>
                <div className="flex justify-between items-center"><span className="text-neutral-400">Visitantes Site</span><span className="font-bold text-white">Conjunto</span></div>
                <div className="flex justify-between items-center pt-3 border-t border-neutral-800 mt-2"><span className="text-neutral-500">Total</span><span className="font-bold text-white">R$ 250</span></div>
              </div>
            </div>

            <div className="bg-[#18181b] border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col h-full hover:border-orange-500/50 transition-colors relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
              <h3 className="text-xl font-bold mb-1 text-white mt-2">3. Remarketing</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-4 block">Fundo (20%)</span>
              <p className="text-neutral-400 text-sm mb-6 flex-grow">
                Onde fechamos a venda. Urgência, prova social e cupons para usuários com alta intenção.
              </p>
              <div className="bg-[#111] border border-neutral-800 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center"><span className="text-neutral-400">Checkout</span><span className="font-bold text-orange-500">R$ 100</span></div>
                <div className="flex justify-between items-center"><span className="text-neutral-400">View Content</span><span className="font-bold text-white">R$ 70</span></div>
                <div className="flex justify-between items-center"><span className="text-neutral-400">Engaj. 7D</span><span className="font-bold text-white">R$ 30</span></div>
              </div>
            </div>

            <div className="bg-[#18181b] border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col h-full hover:border-neutral-700 transition-colors relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-neutral-700" />
              <h3 className="text-xl font-bold mb-1 text-white mt-2">4. Engajamento</h3>
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 block">Motor Base</span>
              <p className="text-neutral-400 text-sm mb-6 flex-grow">
                Campanha barata rodando para público frio com vídeos, alimentando remarketing continuamente.
              </p>
              <div className="bg-[#111] border border-neutral-800 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center"><span className="text-neutral-400">Objetivo: Vídeo</span><span className="font-bold text-white">R$ 50/dia</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Orçamento */}
      <section id="orcamento" className="py-24 bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <SectionTitle
            title="Projeção e Investimento"
            subtitle="Plano de alocação mensal com base em R$ 1.050 diários. Metas claras de CAC."
          />
          <div className="grid lg:grid-cols-2 gap-12 mt-16 items-center">
            <div className="bg-[#18181b] border border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-[#111] border-b border-neutral-800 px-6 py-5">
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <IconChart className="w-5 h-5 text-orange-500" /> Distribuição de Verba (30 Dias)
                </h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-[#141416] text-neutral-500 border-b border-neutral-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Fase do Funil</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Diário</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Mensal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/50">
                  <tr className="hover:bg-[#1f1f22] transition-colors">
                    <td className="px-6 py-4 font-medium text-neutral-300">Prospecção (55%)</td>
                    <td className="px-6 py-4 text-right text-white">R$ 550</td>
                    <td className="px-6 py-4 text-right font-semibold text-white">R$ 16.500</td>
                  </tr>
                  <tr className="hover:bg-[#1f1f22] transition-colors">
                    <td className="px-6 py-4 font-medium text-neutral-300">Consideração (25%)</td>
                    <td className="px-6 py-4 text-right text-white">R$ 250</td>
                    <td className="px-6 py-4 text-right font-semibold text-white">R$ 7.500</td>
                  </tr>
                  <tr className="hover:bg-[#1f1f22] transition-colors">
                    <td className="px-6 py-4 font-medium text-neutral-300">Remarketing (20%)</td>
                    <td className="px-6 py-4 text-right text-orange-500 font-bold">R$ 200</td>
                    <td className="px-6 py-4 text-right font-semibold text-white">R$ 6.000</td>
                  </tr>
                  <tr className="hover:bg-[#1f1f22] transition-colors bg-[#111]/50">
                    <td className="px-6 py-4 font-medium text-neutral-400">Motor Engajamento</td>
                    <td className="px-6 py-4 text-right text-neutral-400">R$ 50</td>
                    <td className="px-6 py-4 text-right font-semibold text-neutral-400">R$ 1.500</td>
                  </tr>
                  <tr className="bg-orange-500 text-white">
                    <td className="px-6 py-5 font-bold">Total Investido</td>
                    <td className="px-6 py-5 text-right font-bold">R$ 1.050/dia</td>
                    <td className="px-6 py-5 text-right font-bold text-lg">R$ 31.500/mês</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-6">
              <div className="p-8 border border-neutral-800 rounded-2xl bg-[#18181b] relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-32 h-32 bg-orange-500/5 blur-2xl rounded-full pointer-events-none" />
                <p className="text-orange-500 text-xs font-black uppercase tracking-widest mb-2 relative z-10">CPA Alvo (Objetivo)</p>
                <div className="flex items-end gap-2 relative z-10">
                  <h4 className="text-5xl font-extrabold text-white">R$ 120 <span className="text-2xl font-medium text-neutral-500">a R$ 150</span></h4>
                </div>
                <p className="text-sm text-neutral-400 mt-3 relative z-10">Custo médio projetado por reserva direta (Full Funnel).</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 border border-neutral-800 rounded-2xl bg-[#111] shadow-sm">
                  <p className="text-neutral-500 text-xs font-bold uppercase tracking-wider mb-2">Cenário Base</p>
                  <h4 className="text-3xl font-extrabold text-white mb-1">~210</h4>
                  <p className="text-sm text-neutral-400">Vendas/mês (CPA R$ 150)</p>
                </div>
                <div className="p-6 border border-orange-500/30 rounded-2xl bg-orange-500/5 shadow-sm">
                  <p className="text-orange-500 text-xs font-bold uppercase tracking-wider mb-2">Otimizado</p>
                  <h4 className="text-3xl font-extrabold text-orange-500 mb-1">260+</h4>
                  <p className="text-sm text-neutral-300">Vendas/mês (CPA R$ 120)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section id="kpis" className="py-24 bg-[#111111] border-t border-neutral-900">
        <div className="max-w-4xl mx-auto px-6 md:px-12">
          <SectionTitle
            title="Transição inout (30 Dias)"
            subtitle="Migração segura para a nova estrutura sem perder o volume do remarketing atual."
          />
          <div className="mt-16 space-y-6">
            <div className="bg-[#18181b] p-6 rounded-2xl border border-neutral-800 shadow-sm flex flex-col md:flex-row gap-6 items-start hover:border-neutral-700 transition-colors">
              <div className="bg-[#111] border border-neutral-700 text-neutral-300 font-bold px-4 py-2 rounded-lg shrink-0 text-sm">Semana 1</div>
              <div>
                <h4 className="font-bold text-lg text-white mb-2">Setup & Limpeza</h4>
                <p className="text-neutral-400 text-sm">Criação da nova arquitetura de 4 campanhas. Migramos públicos validados (Checkout/Engajamento) e subimos as campanhas <em>Broad</em> de prospecção. Estrutura antiga em stand-by (verba reduzida).</p>
              </div>
            </div>

            <div className="bg-[#18181b] p-6 rounded-2xl border border-neutral-800 shadow-sm flex flex-col md:flex-row gap-6 items-start hover:border-neutral-700 transition-colors">
              <div className="bg-[#111] border border-neutral-700 text-neutral-300 font-bold px-4 py-2 rounded-lg shrink-0 text-sm">Semana 2</div>
              <div>
                <h4 className="font-bold text-lg text-white mb-2">Monitoramento de Frequência</h4>
                <p className="text-neutral-400 text-sm">Acompanhamento agressivo da frequência no Remarketing (R$ 200/dia). Se passar de 5x sem conversão, calibramos o Topo. Início das otimizações de criativos.</p>
              </div>
            </div>

            <div className="bg-[#18181b] p-6 rounded-2xl border border-orange-500/40 border-l-4 border-l-orange-500 shadow-sm flex flex-col md:flex-row gap-6 items-start">
              <div className="bg-orange-500/10 text-orange-500 font-bold px-4 py-2 rounded-lg shrink-0 text-sm border border-orange-500/20">Semana 3 e 4</div>
              <div>
                <h4 className="font-bold text-lg text-white mb-2">Validação e Início da Escala</h4>
                <p className="text-neutral-400 text-sm">Antiga estrutura 100% pausada. O sistema passa a retroalimentar o Remarketing organicamente. CPA do topo estabilizado (&lt; R$ 150) libera aumento gradual de verba (+20%).</p>
              </div>
            </div>
          </div>

          <div className="mt-16 bg-[#18181b] border border-neutral-800 rounded-3xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent opacity-50 pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-4 text-white">Prontos para Escalar?</h3>
              <p className="text-neutral-400 text-lg mb-8 max-w-2xl mx-auto">
                A reestruturação inout elimina o desperdício no &quot;aprendizado limitado&quot; e cria a máquina de aquisição necessária para que o hotel evolua com estabilidade e volume.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-10 text-center text-neutral-500 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="font-extrabold text-xl tracking-tighter text-white opacity-50">inout</span>
          </div>
          <p className="text-xs">Documento Estratégico. Baseado na inteligência e metodologia inout.</p>
        </div>
      </footer>
    </div>
  );
}
