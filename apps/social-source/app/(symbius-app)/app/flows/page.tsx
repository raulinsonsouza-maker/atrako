"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Folder,
  FolderPlus,
  GitBranch,
  LayoutGrid,
  Lightbulb,
  List,
  Plus,
  Search,
  Trash2,
  Workflow,
} from "lucide-react";
import {
  formatRelativePt,
  triggerLabel,
  triggerShortLabel,
} from "@/lib/symbius/triggerLabels";

type Fluxo = {
  id: string;
  nome: string;
  status: string;
  triggerType: string;
  updatedAt: string;
  pastaId: string | null;
  pasta?: { id: string; nome: string } | null;
  _count?: { nos: number; execucoes: number };
};

type Pasta = {
  id: string;
  nome: string;
  _count?: { fluxos: number };
};

type FolderFilter = "all" | "none" | string;
type SideTab = "mine" | "basic" | "sequences";
type StatusFilter = "all" | "PUBLISHED" | "DRAFT";
type TriggerFilter = "all" | string;
type ViewMode = "list" | "grid";

export default function FlowsPage() {
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [pastas, setPastas] = useState<Pasta[]>([]);
  const [filter, setFilter] = useState<FolderFilter>("all");
  const [tab, setTab] = useState<SideTab>("mine");
  const [search, setSearch] = useState("");
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const load = useCallback(async () => {
    const kind =
      tab === "sequences" ? "sequence" : tab === "mine" ? "automation" : undefined;
    const flowsUrl = kind
      ? `/api/symbius/flows?kind=${kind}`
      : "/api/symbius/flows";
    const [fRes, pRes] = await Promise.all([
      fetch(flowsUrl),
      fetch("/api/symbius/folders"),
    ]);
    const fData = await fRes.json();
    const pData = await pRes.json();
    setFluxos(fData.fluxos ?? []);
    setPastas(pData.pastas ?? []);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const triggerOptions = useMemo(() => {
    const set = new Set(fluxos.map((f) => f.triggerType));
    return Array.from(set);
  }, [fluxos]);

  const filtered = useMemo(() => {
    let list = fluxos;
    if (filter === "none") list = list.filter((f) => !f.pastaId);
    else if (filter !== "all") list = list.filter((f) => f.pastaId === filter);

    if (triggerFilter !== "all") {
      list = list.filter((f) => f.triggerType === triggerFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((f) => f.status === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          f.nome.toLowerCase().includes(q) ||
          triggerLabel(f.triggerType).toLowerCase().includes(q),
      );
    }
    return list;
  }, [fluxos, filter, search, triggerFilter, statusFilter]);

  const allSelected =
    filtered.length > 0 && filtered.every((f) => selected.has(f.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((f) => f.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createFolder() {
    if (!folderName.trim()) return;
    const res = await fetch("/api/symbius/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: folderName.trim() }),
    });
    if (res.ok) {
      setFolderName("");
      setCreatingFolder(false);
      await load();
    }
  }

  async function moveToFolder(fluxoId: string, pastaId: string | null) {
    await fetch("/api/symbius/flows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fluxoId, pastaId }),
    });
    await load();
  }

  async function deleteFolder(id: string) {
    if (!confirm("Excluir pasta? As automações ficam sem pasta.")) return;
    await fetch(`/api/symbius/folders?id=${id}`, { method: "DELETE" });
    if (filter === id) setFilter("all");
    await load();
  }

  return (
    <div className="symbius-light -m-0 flex min-h-full flex-col bg-[#f4f5f7] text-zinc-900">
      <div className="border-b border-zinc-200 bg-white px-5 py-3">
        <h1 className="text-base font-semibold text-zinc-800">Automação</h1>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Secondary nav */}
        <aside className="hidden w-56 shrink-0 border-r border-zinc-200 bg-white md:block">
          <nav className="space-y-0.5 p-3">
            <SideBtn
              active={tab === "mine"}
              onClick={() => setTab("mine")}
              icon={<Folder className="h-4 w-4" />}
              label="Minhas automações"
            />
            <SideBtn
              active={tab === "basic"}
              onClick={() => setTab("basic")}
              icon={<Lightbulb className="h-4 w-4" />}
              label="Básico"
            />
            <SideBtn
              active={tab === "sequences"}
              onClick={() => setTab("sequences")}
              icon={<GitBranch className="h-4 w-4" />}
              label="Sequências"
            />
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-5 md:p-8">
          {/* Mobile tabs */}
          <div className="mb-4 flex gap-2 md:hidden">
            {(
              [
                ["mine", "Minhas"],
                ["basic", "Básico"],
                ["sequences", "Sequências"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === id
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "basic" && (
            <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 text-center">
              <Lightbulb className="mx-auto h-10 w-10 text-amber-400" />
              <h2 className="mt-4 text-xl font-bold">Modelos básicos</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Escolha um template pronto e publique em poucos passos.
              </p>
              <Link
                href="/app/flows/new"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#2d6cdf] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#255bbd]"
              >
                <Plus className="h-4 w-4" />
                Ver modelos
              </Link>
            </div>
          )}

          {tab === "sequences" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Sequências</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Drip campaigns ativadas quando uma tag é aplicada ao contato.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/symbius/flows", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        nome: "Nova sequência",
                        template: "sequence",
                        fluxoKind: "sequence",
                      }),
                    });
                    void load();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2d6cdf] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#255bbd]"
                >
                  <Plus className="h-4 w-4" />
                  Nova sequência
                </button>
              </div>
              <div className="mt-6 space-y-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhuma sequência ainda.</p>
                ) : (
                  filtered.map((f) => (
                    <Link
                      key={f.id}
                      href={`/app/flows/${f.id}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-[#2d6cdf]"
                    >
                      <span className="font-medium">{f.nome}</span>
                      <span className="text-xs text-zinc-500">{f.status}</span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "mine" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold tracking-tight">
                  Minhas Automações
                </h2>
                <Link
                  href="/app/flows/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2d6cdf] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#255bbd]"
                >
                  <Plus className="h-4 w-4" />
                  Nova Automação
                </Link>
              </div>

              {/* Search + filters */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Pesquisar todas as automações"
                    className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#2d6cdf] focus:ring-2 focus:ring-[#2d6cdf]/20"
                  />
                </div>
                <select
                  value={triggerFilter}
                  onChange={(e) => setTriggerFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none"
                >
                  <option value="all">Qualquer gatilho</option>
                  {triggerOptions.map((t) => (
                    <option key={t} value={t}>
                      {triggerShortLabel(t)}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none"
                >
                  <option value="all">Estados variados</option>
                  <option value="PUBLISHED">LIVE</option>
                  <option value="DRAFT">Rascunho</option>
                </select>
              </div>

              {/* Folders */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    filter === "all"
                      ? "border-[#2d6cdf] bg-white text-[#2d6cdf] shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  <Folder className="h-4 w-4" />
                  Todas
                  <span className="text-zinc-400">({fluxos.length})</span>
                </button>

                {pastas.map((p) => (
                  <div key={p.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => setFilter(p.id)}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                        filter === p.id
                          ? "border-[#2d6cdf] bg-white text-[#2d6cdf] shadow-sm"
                          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                      }`}
                    >
                      <Folder className="h-4 w-4 text-[#2d6cdf]" />
                      {p.nome}
                      <span className="text-zinc-400">
                        ({p._count?.fluxos ?? 0})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFolder(p.id)}
                      className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-white group-hover:flex"
                      title="Excluir pasta"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {creatingFolder ? (
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
                    <input
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createFolder()}
                      className="w-36 border-0 bg-transparent text-sm outline-none"
                      placeholder="Nome da pasta"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={createFolder}
                      className="text-sm font-semibold text-[#2d6cdf]"
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatingFolder(false)}
                      className="text-sm text-zinc-400"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(true)}
                    className="flex items-center gap-2 rounded-xl border border-dashed border-[#2d6cdf]/40 px-4 py-3 text-sm font-medium text-[#2d6cdf] hover:bg-[#2d6cdf]/5"
                  >
                    <FolderPlus className="h-4 w-4" />
                    Nova Pasta
                  </button>
                )}

                <div className="ml-auto flex items-center gap-3 text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-1.5 opacity-50">
                    <Trash2 className="h-4 w-4" />
                    Lixeira
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setViewMode((v) => (v === "list" ? "grid" : "list"))
                    }
                    className="inline-flex items-center gap-1.5 hover:text-zinc-800"
                  >
                    {viewMode === "list" ? (
                      <>
                        <LayoutGrid className="h-4 w-4" />
                        Visualização grade
                      </>
                    ) : (
                      <>
                        <List className="h-4 w-4" />
                        Visualização lista
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* List / Grid */}
              {filtered.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-12 text-center">
                  <Workflow className="mx-auto h-10 w-10 text-zinc-300" />
                  <p className="mt-4 text-zinc-500">
                    Nenhuma automação encontrada.
                  </p>
                  <Link
                    href="/app/flows/new"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#2d6cdf] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#255bbd]"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Automação
                  </Link>
                </div>
              ) : viewMode === "grid" ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((f) => (
                    <FluxoCard
                      key={f.id}
                      f={f}
                      pastas={pastas}
                      onMove={moveToFolder}
                      checked={selected.has(f.id)}
                      onToggle={() => toggleOne(f.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6">
                  <div className="mb-2 hidden grid-cols-[auto_1fr_5rem_4.5rem_6.5rem] items-center gap-3 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-400 md:grid">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    <span>Nome</span>
                    <span className="text-right">Execuções</span>
                    <span className="text-right">CTR</span>
                    <span className="text-right">Modificado</span>
                  </div>
                  <div className="space-y-2">
                    {filtered.map((f) => (
                      <FluxoRow
                        key={f.id}
                        f={f}
                        pastas={pastas}
                        onMove={moveToFolder}
                        checked={selected.has(f.id)}
                        onToggle={() => toggleOne(f.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function SideBtn({
  active,
  onClick,
  icon,
  label,
  soon,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  soon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-zinc-100 font-semibold text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      <span className={active ? "text-zinc-800" : "text-zinc-400"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {soon && (
        <span className="text-[9px] font-bold uppercase text-amber-500">
          Em breve
        </span>
      )}
    </button>
  );
}

function LiveBadge({ status }: { status: string }) {
  if (status === "PUBLISHED") {
    return (
      <span className="inline-flex shrink-0 rounded bg-[#e11d48] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        LIVE
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
      Rascunho
    </span>
  );
}

function FluxoRow({
  f,
  pastas,
  onMove,
  checked,
  onToggle,
}: {
  f: Fluxo;
  pastas: Pasta[];
  onMove: (id: string, pastaId: string | null) => void;
  checked: boolean;
  onToggle: () => void;
}) {
  const exec = f._count?.execucoes ?? 0;
  return (
    <div className="grid grid-cols-1 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-zinc-300 md:grid-cols-[auto_1fr_5rem_4.5rem_6.5rem]">
      <div className="flex items-start gap-3 md:contents">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 md:mt-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge status={f.status} />
            <Link
              href={`/app/flows/${f.id}`}
              className="truncate font-semibold text-zinc-900 hover:text-[#2d6cdf]"
            >
              {f.nome}
            </Link>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
            {triggerLabel(f.triggerType)}
          </p>
          <select
            value={f.pastaId ?? ""}
            onChange={(e) => onMove(f.id, e.target.value || null)}
            className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600 md:hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">Sem pasta</option>
            {pastas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-left text-lg font-semibold tabular-nums text-zinc-800 md:text-right">
        <span className="mr-2 text-xs font-normal text-zinc-400 md:hidden">
          Execuções
        </span>
        {exec}
      </p>
      <p className="text-left text-sm tabular-nums text-zinc-500 md:text-right">
        <span className="mr-2 text-xs text-zinc-400 md:hidden">CTR</span>—
      </p>
      <p className="text-left text-sm text-zinc-500 md:text-right">
        {formatRelativePt(f.updatedAt)}
      </p>
    </div>
  );
}

function FluxoCard({
  f,
  pastas,
  onMove,
  checked,
  onToggle,
}: {
  f: Fluxo;
  pastas: Pasta[];
  onMove: (id: string, pastaId: string | null) => void;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="h-4 w-4 rounded border-zinc-300"
          />
          <LiveBadge status={f.status} />
        </div>
        <span className="text-xs text-zinc-400">
          {formatRelativePt(f.updatedAt)}
        </span>
      </div>
      <Link
        href={`/app/flows/${f.id}`}
        className="mt-2 block font-semibold text-zinc-900 hover:text-[#2d6cdf]"
      >
        {f.nome}
      </Link>
      <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
        {triggerLabel(f.triggerType)}
      </p>
      <div className="mt-4 flex items-end justify-between border-t border-zinc-100 pt-3">
        <div>
          <p className="text-[10px] uppercase text-zinc-400">Execuções</p>
          <p className="text-lg font-semibold">{f._count?.execucoes ?? 0}</p>
        </div>
        <select
          value={f.pastaId ?? ""}
          onChange={(e) => onMove(f.id, e.target.value || null)}
          className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600"
        >
          <option value="">Sem pasta</option>
          {pastas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
