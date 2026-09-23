"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, Search } from "lucide-react";

type Plano = {
  slug: string;
  nome: string;
  cliente: string;
  descricao: string;
  tag: string;
  updatedAt: string;
};

const PLANOS: Plano[] = [
  {
    slug: "proposta-construtora",
    nome: "Análise Interna — Construtora",
    cliente: "Inout",
    descricao: "Comparativo completo dos dois modelos (Híbrido e Performance) com VGV por empreendimento, análise financeira, riscos e contexto para a call. Uso interno.",
    tag: "Análise",
    updatedAt: "Mai 2026",
  },
  {
    slug: "proposta-construtora-hibrido",
    nome: "Proposta Híbrido — Construtora",
    cliente: "Construtora Maringá",
    descricao: "Proposta cliente: R$ 2k/mês fee + 1% VGV sobre vendas atribuídas. Gestão completa de Meta Ads, Google Ads e CRM para Luminare, Kantoo e Sarandi.",
    tag: "Proposta",
    updatedAt: "Mai 2026",
  },
  {
    slug: "proposta-construtora-performance",
    nome: "Proposta Performance — Construtora",
    cliente: "Construtora Maringá",
    descricao: "Proposta cliente: zero fee + 1% VGV sobre vendas atribuídas. Operação completa de mídia e CRM — agência só recebe quando vende.",
    tag: "Proposta",
    updatedAt: "Mai 2026",
  },
  {
    slug: "inout-2026",
    nome: "Planejamento Inout 2026",
    cliente: "Inout",
    descricao: "Estratégia de nicho imobiliário, ICP, simuladores de receita e VGV — faturamento alvo de R$ 2,5M em 2026.",
    tag: "Estratégia",
    updatedAt: "Abr 2026",
  },
  {
    slug: "hotel-fazenda-sao-joao",
    nome: "Máquina de Aquisição",
    cliente: "Hotel Fazenda São João",
    descricao: "Reestruturação da conta Meta Ads — consolidação de 23 conjuntos em 4 campanhas e novo funil de prospecção com R$ 1.050/dia.",
    tag: "Meta Ads",
    updatedAt: "Abr 2026",
  },
  {
    slug: "assumindo-riscos",
    nome: "Assumindo Riscos",
    cliente: "Inout",
    descricao: "Modelo de parceria com skin in the game — fee fixo + variável atrelado a vendas. Operação diária no comercial do cliente, gestão de funil e resultado compartilhado.",
    tag: "Estratégia",
    updatedAt: "Abr 2026",
  },
];

function normalizeForSearch(text: string): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function PlanejamentoPage() {
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredPlanos = React.useMemo(() => {
    if (!searchQuery.trim()) return PLANOS;
    const q = normalizeForSearch(searchQuery);
    return PLANOS.filter(
      (p) =>
        normalizeForSearch(p.nome).includes(q) ||
        normalizeForSearch(p.cliente).includes(q)
    );
  }, [searchQuery]);

  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(160deg,rgba(22,23,28,0.99)_0%,rgba(12,12,16,1)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--primary)] opacity-[0.05] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-[var(--primary)] opacity-[0.03] blur-3xl" />

        <div className="relative px-8 pb-6 pt-8 sm:px-10 sm:pt-10">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            Consultoria estratégica
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            <span className="text-[var(--foreground)]">Central de </span>
            <span className="bg-gradient-to-r from-[var(--primary)] to-[#ff9a40] bg-clip-text text-transparent">
              Planejamento
            </span>
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted-foreground)]">
            Planos táticos e estratégicos elaborados pela inout para apresentação e alinhamento com clientes.
          </p>
        </div>

        <div className="h-px bg-[var(--border)]/50" />

        <div className="relative px-8 py-4 sm:px-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Pesquisar por cliente ou plano..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]/40 focus:bg-white/[0.06] focus:outline-none transition-colors"
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          {searchQuery
            ? `${filteredPlanos.length} resultado${filteredPlanos.length !== 1 ? "s" : ""}`
            : `${PLANOS.length} plano${PLANOS.length !== 1 ? "s" : ""}`}
        </span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="space-y-2">
        {filteredPlanos.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center text-sm text-[var(--muted-foreground)]">
            Nenhum plano encontrado para essa busca.
          </div>
        ) : (
          filteredPlanos.map((p) => (
            <Link
              key={p.slug}
              href={`/planejamento/${p.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 transition-all hover:border-[var(--primary)]/30 hover:bg-[var(--card-hover)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--foreground)]">
                  {p.cliente}
                  <span className="ml-2 text-[var(--muted-foreground)] font-normal">— {p.nome}</span>
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-1">{p.descricao}</p>
              </div>
              <div className="hidden shrink-0 items-center gap-4 sm:flex">
                <span className="rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                  {p.tag}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">{p.updatedAt}</span>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)]">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
