"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";

type UsageRow = {
  clienteId: string;
  clienteNome: string;
  userName: string | null;
  userEmail: string | null;
  requestVolume: number;
  successCount: number;
  errorCount: number;
  tokenTotal: number;
  estimatedCost: number;
  averageLatencyMs: number | null;
};

type RolloutUser = { id: string; name: string | null; email: string; role: string };
type RolloutClient = { id: string; nome: string; slug: string; inPilotEnabled: boolean };

export default function InPilotUsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rolloutLoading, setRolloutLoading] = useState(true);
  const [rolloutSaving, setRolloutSaving] = useState(false);
  const [rolloutError, setRolloutError] = useState("");
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [allowAllClients, setAllowAllClients] = useState(false);
  const [rolloutSavedAllowAllClients, setRolloutSavedAllowAllClients] = useState(false);
  const [rolloutSavedEnabled, setRolloutSavedEnabled] = useState(false);
  const [rolloutRevision, setRolloutRevision] = useState(0);
  const [allowedInternalUserIds, setAllowedInternalUserIds] = useState<string[]>([]);
  const [allowedClientIds, setAllowedClientIds] = useState<string[]>([]);
  const [rolloutUsers, setRolloutUsers] = useState<RolloutUser[]>([]);
  const [rolloutClients, setRolloutClients] = useState<RolloutClient[]>([]);
  const globalStatePending = globalEnabled !== rolloutSavedEnabled;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/inpilot-usage");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o uso do InPilot.");
      setRows(data.rows ?? []);
      setWindowDays(data.windowDays ?? 30);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function loadRollout(notice = "") {
    setRolloutLoading(true);
    setRolloutError(notice);
    try {
      const response = await fetch("/api/admin/inpilot-rollout", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as regras de acesso.");
      setGlobalEnabled(data.config?.enabled === true);
      setAllowAllClients(data.config?.allowAllClients === true);
      setRolloutSavedAllowAllClients(data.config?.allowAllClients === true);
      setRolloutSavedEnabled(data.config?.enabled === true);
      setRolloutRevision(Number.isSafeInteger(data.config?.revision) ? data.config.revision : 0);
      setAllowedInternalUserIds(data.config?.allowedInternalUserIds ?? []);
      setAllowedClientIds(data.config?.allowedClientIds ?? []);
      setRolloutUsers(data.users ?? []);
      setRolloutClients(data.clients ?? []);
    } catch (reason) {
      setRolloutError(reason instanceof Error ? reason.message : "Não foi possível carregar as regras de acesso.");
    } finally {
      setRolloutLoading(false);
    }
  }

  useEffect(() => { void loadRollout(); }, []);

  async function saveRollout() {
    const enablingFromLocalOff = globalEnabled && !rolloutSavedEnabled;
    const enablingAllClients = allowAllClients && !rolloutSavedAllowAllClients;
    if ((enablingFromLocalOff || enablingAllClients) && !window.confirm(
      allowAllClients
        ? "Liberar o InPilot para todos os clientes habilitados, incluindo os criados no futuro?"
        : "Disponibilizar o InPilot? Somente os usuários e clientes selecionados abaixo terão acesso.",
    )) {
      return;
    }
    setRolloutSaving(true);
    setRolloutError("");
    try {
      const response = await fetch("/api/admin/inpilot-rollout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: globalEnabled,
          allowAllClients,
          expectedRevision: rolloutRevision,
          allowedInternalUserIds,
          allowedClientIds,
          ...(enablingFromLocalOff ? { confirmEnableGlobal: true } : {}),
          ...(enablingAllClients ? { confirmEnableAllClients: true } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          await loadRollout(data.code === "ROLLOUT_REVISION_CONFLICT"
            ? "As permissões foram alteradas por outro administrador. Recarregamos a versão mais recente; revise e salve novamente."
            : (data.error || "A configuração mudou; a versão atual foi recarregada."));
          return;
        }
        throw new Error(data.error || "Não foi possível salvar as regras de acesso.");
      }
      setGlobalEnabled(data.config?.enabled === true);
      setAllowAllClients(data.config?.allowAllClients === true);
      setRolloutSavedAllowAllClients(data.config?.allowAllClients === true);
      setRolloutSavedEnabled(data.config?.enabled === true);
      setRolloutRevision(Number.isSafeInteger(data.config?.revision) ? data.config.revision : 0);
      setAllowedInternalUserIds(data.config?.allowedInternalUserIds ?? []);
      setAllowedClientIds(data.config?.allowedClientIds ?? []);
      setRolloutUsers(data.users ?? rolloutUsers);
      setRolloutClients(data.clients ?? rolloutClients);
    } catch (reason) {
      setRolloutError(reason instanceof Error ? reason.message : "Não foi possível salvar as regras de acesso.");
    } finally {
      setRolloutSaving(false);
    }
  }

  function toggleGlobal() {
    setGlobalEnabled((enabled) => !enabled);
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 py-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 h-8 w-1 rounded-full bg-[var(--primary)]" />
          <div>
            <p className="type-micro-legal uppercase text-[var(--primary)]">Administração</p>
            <h1 className="type-lead-airy font-extrabold ">Uso e acesso do InPilot</h1>
            <p className="mt-1 type-caption text-[var(--muted-foreground)]">Defina quem pode usar o InPilot e acompanhe volume, custos, latência e erros dos últimos {windowDays} dias.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/configuracoes" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 type-caption-strong text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <ArrowLeft className="h-3.5 w-3.5" /> Configurações
          </Link>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 type-caption-strong text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </header>

      {error && <p className="rounded-lg bg-red-500/10 px-4 py-3 type-caption text-red-400">{error}</p>}
      <section className={`rounded-2xl border p-5 ${globalEnabled ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/40 bg-red-500/10"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`type-micro-legal uppercase ${globalEnabled ?"text-emerald-400" :"text-red-300"}`}>
              {globalStatePending
                ? (globalEnabled ? "Ativação pendente" : "Desativação pendente")
                : (globalEnabled ? "InPilot disponível" : "InPilot indisponível")}
            </p>
            <h2 className="mt-1 type-tagline ">Disponibilidade do InPilot</h2>
            <p className="mt-1 max-w-2xl type-caption text-[var(--muted-foreground)]">
              {globalEnabled
                ? "O InPilot está disponível. Para entrar, a pessoa precisa estar ativa e selecionada abaixo, e o cliente também precisa estar liberado."
                : "O InPilot está indisponível para todos, independentemente das seleções abaixo."}
              {globalEnabled && (allowAllClients ? " Todos os clientes atuais e futuros estão incluídos." : " Somente os clientes selecionados estão incluídos.")}
              {globalStatePending
                 ? " Esta mudança ainda não foi salva."
                 : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleGlobal}
            disabled={rolloutLoading || rolloutSaving}
            className={`rounded-xl px-4 py-2.5 type-caption-strong ${globalEnabled ?"border border-red-400/40 text-red-300 hover:bg-red-500/10" :"bg-red-500 text-white hover:bg-red-400"}`}
          >
            {globalEnabled ? "Desativar para todos" : "Disponibilizar InPilot"}
          </button>
        </div>
        {rolloutError && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 type-caption text-red-300">{rolloutError}</p>}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <fieldset className="rounded-xl border border-[var(--border)] p-4">
            <legend className="px-2 type-caption-strong uppercase text-[var(--muted-foreground)]">1. Quem pode usar</legend>
            <p className="mb-3 type-fine-print text-[var(--muted-foreground)]">Selecione os usuários internos autorizados. Somente pessoas ativas aparecem aqui ({allowedInternalUserIds.length} selecionado(s)).</p>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {rolloutUsers.map((user) => (
                <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 type-caption hover:bg-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={allowedInternalUserIds.includes(user.id)}
                    onChange={(event) => setAllowedInternalUserIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))}
                  />
                  <span>{user.name || user.email}<span className="ml-1 type-fine-print text-[var(--muted-foreground)]">({user.role})</span></span>
                </label>
              ))}
              {!rolloutLoading && rolloutUsers.length === 0 && <p className="type-fine-print text-[var(--muted-foreground)]">Nenhum usuário interno ativo.</p>}
            </div>
          </fieldset>
          <fieldset className="rounded-xl border border-[var(--border)] p-4">
            <legend className="px-2 type-caption-strong uppercase text-[var(--muted-foreground)]">2. Em quais clientes</legend>
            <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--border)] p-3 type-caption">
              <input
                type="checkbox"
                checked={allowAllClients}
                onChange={(event) => setAllowAllClients(event.target.checked)}
              />
              <span>
                <strong>Todos os clientes atuais e futuros</strong>
                <span className="mt-0.5 block type-fine-print text-[var(--muted-foreground)]">Inclui automaticamente novos clientes que tiverem o InPilot habilitado no cadastro.</span>
              </span>
            </label>
            <p className="mb-3 type-fine-print text-[var(--muted-foreground)]">{allowAllClients ? "Desmarque a opção acima para escolher clientes individualmente." : `Selecione os clientes que poderão usar o InPilot (${allowedClientIds.length} selecionado(s)).`}</p>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {rolloutClients.map((client) => (
                <label key={client.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 type-caption hover:bg-[var(--muted)]">
                  <input
                    type="checkbox"
                    disabled={allowAllClients}
                    checked={allowedClientIds.includes(client.id)}
                    onChange={(event) => setAllowedClientIds((current) => event.target.checked ? [...current, client.id] : current.filter((id) => id !== client.id))}
                  />
                  <span>{client.nome}<span className={`ml-1 type-fine-print ${client.inPilotEnabled ?"text-emerald-400" :"text-red-300"}`}>{client.inPilotEnabled ?"habilitado no cadastro" :"desabilitado no cadastro"}</span></span>
                </label>
              ))}
              {!rolloutLoading && rolloutClients.length === 0 && <p className="type-fine-print text-[var(--muted-foreground)]">Nenhum cliente ativo.</p>}
            </div>
          </fieldset>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="type-fine-print text-[var(--muted-foreground)]">{globalStatePending ? "Há uma mudança de disponibilidade aguardando salvamento." : "Revise as seleções antes de salvar."}</p>
          <button type="button" onClick={() => void saveRollout()} disabled={rolloutLoading || rolloutSaving} className="rounded-lg bg-[var(--primary)] px-4 py-2 type-caption-strong text-[var(--primary-foreground)] disabled:opacity-50">
             {rolloutSaving ? "Salvando…" : "Salvar acesso do InPilot"}
          </button>
        </div>
      </section>
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[900px] text-left type-caption">
          <thead className="border-b border-[var(--border)] type-fine-print uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Solicitações</th>
              <th className="px-4 py-3">Sucessos / erros</th>
              <th className="px-4 py-3">Tokens</th>
              <th className="px-4 py-3">Custo estimado</th>
              <th className="px-4 py-3">Latência média</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">Nenhuma análise no período.</td></tr>
            ) : rows.map((row) => (
              <tr key={`${row.clienteId}:${row.userEmail ?? "unknown"}`}>
                <td className="px-4 py-3 font-semibold">{row.clienteNome}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{row.userName || "Sem nome"}<br /><span className="type-fine-print">{row.userEmail || "—"}</span></td>
                <td className="px-4 py-3">{row.requestVolume}</td>
                <td className="px-4 py-3"><span className="text-emerald-400">{row.successCount}</span> / <span className="text-red-400">{row.errorCount}</span></td>
                <td className="px-4 py-3">{row.tokenTotal.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">US$ {row.estimatedCost.toFixed(4)}</td>
                <td className="px-4 py-3">{row.averageLatencyMs == null ? "—" : `${row.averageLatencyMs.toLocaleString("pt-BR")} ms`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}