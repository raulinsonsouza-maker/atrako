"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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
    <AppPage
      title="InPilot"
      actions={
        <Button type="button" variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
          Atualizar
        </Button>
      }
    >
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        Últimos {windowDays} dias · quem pode usar e uso por workspace
      </p>

      {error ? (
        <p className="rounded-[var(--radius-xs)] bg-[var(--accent)]/10 px-3 py-2 type-caption text-[var(--accent)]">
          {error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="type-caption-strong text-[var(--ink)]">
              {globalEnabled ? "Disponível" : "Indisponível"}
              {globalStatePending ? " · pendente" : ""}
            </p>
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              {globalEnabled
                ? allowAllClients
                  ? "Usuários selecionados · todos os workspaces"
                  : "Usuários e workspaces selecionados"
                : "Ninguém acessa o InPilot"}
            </p>
          </div>
          <Switch
            checked={globalEnabled}
            onChange={() => toggleGlobal()}
            disabled={rolloutLoading || rolloutSaving}
            aria-label="Disponibilidade do InPilot"
          />
        </div>

        {rolloutError ? (
          <p className="rounded-[var(--radius-xs)] bg-[var(--accent)]/10 px-3 py-2 type-caption text-[var(--accent)]">
            {rolloutError}
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="type-caption-strong text-[var(--ink)]">
              Usuários ({allowedInternalUserIds.length})
            </p>
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {rolloutUsers.map((user) => {
                const on = allowedInternalUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-xs)] px-2 py-1.5"
                  >
                    <span className="min-w-0 truncate type-caption text-[var(--ink)]">
                      {user.name || user.email}
                    </span>
                    <Switch
                      checked={on}
                      onChange={(checked) =>
                        setAllowedInternalUserIds((current) =>
                          checked ? [...current, user.id] : current.filter((id) => id !== user.id),
                        )
                      }
                      aria-label={user.name || user.email}
                    />
                  </div>
                );
              })}
              {!rolloutLoading && rolloutUsers.length === 0 ? (
                <p className="type-fine-print text-[var(--ink-muted-48)]">Nenhum usuário ativo.</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="type-caption-strong text-[var(--ink)]">Workspaces</p>
              <div className="flex items-center gap-2">
                <span className="type-fine-print text-[var(--ink-muted-48)]">Todos</span>
                <Switch
                  checked={allowAllClients}
                  onChange={setAllowAllClients}
                  aria-label="Todos os workspaces"
                />
              </div>
            </div>
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {rolloutClients.map((client) => {
                const on = allowedClientIds.includes(client.id);
                return (
                  <div
                    key={client.id}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-xs)] px-2 py-1.5"
                  >
                    <span className="min-w-0 truncate type-caption text-[var(--ink)]">{client.nome}</span>
                    <Switch
                      checked={on}
                      onChange={(checked) =>
                        setAllowedClientIds((current) =>
                          checked
                            ? [...current, client.id]
                            : current.filter((id) => id !== client.id),
                        )
                      }
                      disabled={allowAllClients}
                      aria-label={client.nome}
                    />
                  </div>
                );
              })}
              {!rolloutLoading && rolloutClients.length === 0 ? (
                <p className="type-fine-print text-[var(--ink-muted-48)]">Nenhum workspace ativo.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-[var(--hairline)] pt-3">
          <Button
            type="button"
            disabled={rolloutLoading || rolloutSaving}
            onClick={() => void saveRollout()}
          >
            {rolloutSaving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </section>

      <div className="overflow-x-auto rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]">
        <table className="w-full min-w-[900px] text-left type-caption">
          <thead className="border-b border-[var(--hairline)] type-fine-print text-[var(--ink-muted-48)]">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Solicitações</th>
              <th className="px-4 py-3 font-medium">Sucessos / erros</th>
              <th className="px-4 py-3 font-medium">Tokens</th>
              <th className="px-4 py-3 font-medium">Custo</th>
              <th className="px-4 py-3 font-medium">Latência</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-muted-48)]">
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--ink-muted-48)]">
                  Nenhuma análise no período.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.clienteId}:${row.userEmail ?? "unknown"}`}>
                  <td className="px-4 py-3 type-caption-strong text-[var(--ink)]">{row.clienteNome}</td>
                  <td className="px-4 py-3 text-[var(--ink-muted-48)]">
                    {row.userName || "Sem nome"}
                    <br />
                    <span className="type-fine-print">{row.userEmail || "—"}</span>
                  </td>
                  <td className="px-4 py-3">{row.requestVolume}</td>
                  <td className="px-4 py-3">
                    <span className="text-[var(--success)]">{row.successCount}</span>
                    {" / "}
                    <span className="text-[var(--danger)]">{row.errorCount}</span>
                  </td>
                  <td className="px-4 py-3">{row.tokenTotal.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">US$ {row.estimatedCost.toFixed(4)}</td>
                  <td className="px-4 py-3">
                    {row.averageLatencyMs == null
                      ? "—"
                      : `${row.averageLatencyMs.toLocaleString("pt-BR")} ms`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppPage>
  );
}