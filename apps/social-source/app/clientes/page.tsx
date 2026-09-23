"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClienteCard, type ClienteCardData } from "@/components/clientes/ClienteCard";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Plus, Search, LayoutList, LayoutGrid, ArrowUpRight } from "lucide-react";

async function fetchClientes(): Promise<ClienteCardData[]> {
  const [clientesRes, segmentosRes] = await Promise.all([
    fetch("/api/clientes"),
    fetch("/api/admin/segmentos"),
  ]);
  const data = await clientesRes.json().catch(() => ({}));
  if (!clientesRes.ok) {
    const msg = (data as { error?: string }).error ?? "Falha ao carregar clientes";
    throw new Error(msg);
  }
  const segmentos: { nome: string; cor: string }[] = await segmentosRes.json().catch(() => []);
  const segMap: Record<string, string> = {};
  for (const s of segmentos) segMap[s.nome] = s.cor;
  return (data as ClienteCardData[]).map((c) => ({
    ...c,
    segmentoCor: c.segmento ? segMap[c.segmento] ?? null : null,
  }));
}

function normalizeForSearch(text: string): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const SQUAD_STORAGE_KEY = "inout:central:squadFilter";
type SquadFilter = "todos" | "1" | "2" | "3";

export default function CentralClientesPage() {
  const [viewMode, setViewMode] = React.useState<"lista" | "card">("lista");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [squadFilter, setSquadFilter] = React.useState<SquadFilter | null>(null);

  React.useEffect(() => {
    let initial: SquadFilter = "todos";
    try {
      const raw = window.localStorage.getItem(SQUAD_STORAGE_KEY);
      if (raw === "todos" || raw === "1" || raw === "2" || raw === "3") {
        initial = raw;
      }
    } catch {}
    setSquadFilter(initial);
  }, []);

  React.useEffect(() => {
    if (squadFilter === null) return;
    try {
      window.localStorage.setItem(SQUAD_STORAGE_KEY, squadFilter);
    } catch {}
  }, [squadFilter]);

  const {
    data: clientes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["clientes"],
    queryFn: fetchClientes,
  });

  const activeClientes = React.useMemo(() => {
    if (!clientes) return [];
    const onlyActive = clientes.filter((c) => c.ativo ?? true);
    return [...onlyActive].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [clientes]);

  const squadFilteredClientes = React.useMemo(() => {
    if (!activeClientes) return [];
    if (!squadFilter || squadFilter === "todos") return activeClientes;
    const target = Number(squadFilter);
    return activeClientes.filter((c) => c.squad === target);
  }, [activeClientes, squadFilter]);

  const filteredClientes = React.useMemo(() => {
    if (!searchQuery.trim()) return squadFilteredClientes;
    const q = normalizeForSearch(searchQuery);
    return squadFilteredClientes.filter((c) => normalizeForSearch(c.nome).includes(q));
  }, [squadFilteredClientes, searchQuery]);

  const hydrated = squadFilter !== null;

  const squadOptions: { value: SquadFilter; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "1", label: "Squad 1" },
    { value: "2", label: "Squad 2" },
    { value: "3", label: "Squad 3" },
  ];

  return (
    <main className="space-y-6">

      {/* ── Header unificado ── */}
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(160deg,rgba(22,23,28,0.99)_0%,rgba(12,12,16,1)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--primary)] opacity-[0.05] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-[var(--primary)] opacity-[0.03] blur-3xl" />

        {/* Topo: título */}
        <div className="relative px-8 pb-6 pt-8 sm:px-10 sm:pt-10">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--primary)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
            Consultoria estratégica
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            <span className="text-[var(--foreground)]">Central de </span>
            <span className="bg-gradient-to-r from-[var(--primary)] to-[#ff9a40] bg-clip-text text-transparent">
              Clientes
            </span>
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted-foreground)]">
            Visão completa de cada cliente em um só lugar — métricas de mídia, investimento e resultados
            atualizados para decisões mais rápidas e assertivas.
          </p>
        </div>

        {/* Divisor */}
        <div className="h-px bg-[var(--border)]/50" />

        {/* Rodapé: pesquisa + toggle (sempre na mesma linha) + filtro de segmento */}
        <div className="relative flex flex-col gap-2 px-8 py-4 sm:px-10">
          {/* Linha 1: search + toggle */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                placeholder="Pesquisar por nome do cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]/40 focus:bg-white/[0.06] focus:outline-none transition-colors"
              />
            </div>
            {/* View toggle — compacto, sempre visível */}
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-white/[0.04] p-1">
              <button
                onClick={() => setViewMode("lista")}
                title="Visualização em lista"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  viewMode === "lista"
                    ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20"
                    : "text-[var(--muted-foreground)] hover:bg-white/[0.05] hover:text-[var(--foreground)]"
                }`}
              >
                <LayoutList className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setViewMode("card")}
                title="Visualização em cards"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                  viewMode === "card"
                    ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20"
                    : "text-[var(--muted-foreground)] hover:bg-white/[0.05] hover:text-[var(--foreground)]"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Card</span>
              </button>
            </div>
          </div>

          {/* Linha 2: chips de squad */}
          <div className="flex min-h-[28px] flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Squad
            </span>
            {hydrated
              ? squadOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSquadFilter(opt.value)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${
                      squadFilter === opt.value
                        ? "bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20"
                        : "border border-[var(--border)] bg-white/[0.03] text-[var(--muted-foreground)] hover:border-[var(--primary)]/30 hover:text-[var(--foreground)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))
              : squadOptions.map((opt) => (
                  <span
                    key={opt.value}
                    aria-hidden
                    className="rounded-full border border-transparent bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-transparent"
                  >
                    {opt.label}
                  </span>
                ))}
          </div>
        </div>
      </section>

      {/* Separador "Clientes ativos" */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          {searchQuery
            ? `${filteredClientes.length} resultado${filteredClientes.length !== 1 ? "s" : ""}`
            : squadFilter && squadFilter !== "todos"
              ? `Squad ${squadFilter}`
              : "Clientes ativos"}
          {!searchQuery && filteredClientes.length > 0 && (
            <span className="rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)] normal-case tracking-normal">
              {filteredClientes.length}
            </span>
          )}
        </span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--card)]"
            />
          ))}
        </div>
      )}

      {error && !clientes && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-5 py-4 text-sm text-[var(--accent)]">
          <span className="font-medium">Erro ao carregar clientes.</span>
          <span className="text-[var(--muted-foreground)]">Tente novamente em alguns instantes.</span>
        </div>
      )}

      {/* List view */}
      {clientes && viewMode === "lista" && (
        <div className="space-y-2">
          {filteredClientes.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center text-sm text-[var(--muted-foreground)]">
              {searchQuery
                ? "Nenhum cliente encontrado para essa busca."
                : squadFilter && squadFilter !== "todos"
                  ? `Nenhum cliente neste squad.`
                  : "Nenhum cliente cadastrado."}
            </div>
          ) : (
            filteredClientes.map((c) => {
              const initials = c.nome.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
              return (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 transition-all hover:border-[var(--primary)]/30 hover:bg-[var(--card-hover)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--muted)] to-[var(--border)] text-sm font-bold text-[var(--muted-foreground)]">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--foreground)]">{c.nome}</p>
                      {c.squad && (
                        <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                          S{c.squad}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {c.segmento?.trim() || "Sem segmento"}
                    </p>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-all group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)]">
                    <ArrowUpRight className="h-4 w-4" />
                  </div>
                </Link>
              );
            })
          )}
          <Link
            href="/admin/clientes"
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-transparent py-6 text-sm font-medium text-[var(--muted-foreground)] transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--card)] hover:text-[var(--primary)]"
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </Link>
        </div>
      )}

      {/* Cards grid */}
      {clientes && viewMode === "card" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClientes.length === 0 ? (
            <div className="col-span-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center text-sm text-[var(--muted-foreground)]">
              {searchQuery
                ? "Nenhum cliente encontrado para essa busca."
                : squadFilter && squadFilter !== "todos"
                  ? `Nenhum cliente neste squad.`
                  : "Nenhum cliente cadastrado."}
            </div>
          ) : (
            filteredClientes.map((c) => <ClienteCard key={c.id} cliente={c} />)
          )}

          <Link href="/admin/clientes" className="block">
            <Card className="card-hover group flex h-full cursor-pointer flex-col items-center justify-center rounded-2xl border-dashed border-[var(--border)] bg-transparent transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--card)]">
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)] transition-all group-hover:border-[var(--primary)]/40 group-hover:bg-[var(--primary)]/10 group-hover:text-[var(--primary)]">
                  <Plus className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Novo cliente</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Adicionar unidade de negócio</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--primary)]">
                  <span>Cadastrar</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </main>
  );
}
