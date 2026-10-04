"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail, AlertCircle } from "lucide-react";
import { PillSelect } from "@/components/ui";

type Domain = { id: string; name: string; status: string };

export type ResendStatus = Status;

type Status = {
  connected: boolean;
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  domain?: string | null;
  domainId?: string | null;
  domainStatus?: string | null;
  webhookConfigured?: boolean;
  lastWebhookAt?: string | null;
  warmupDailyCap?: number | null;
  webhookUrl?: string;
  domains?: Domain[];
  domainsError?: string | null;
};

const inputCls =
  "w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2 type-caption text-[var(--ink)]";
const btnPrimary =
  "rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-1.5 type-fine-print text-[var(--on-primary)] active:scale-95 disabled:opacity-50";
const btnOutline =
  "rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-1.5 type-fine-print text-[var(--ink-muted-80)] active:scale-95 disabled:opacity-50";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/atrako/resend/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw Object.assign(new Error(String(json.error ?? "Falha")), { data: json });
  return json;
}

export function resendStatusKey(workspaceId: string) {
  return ["resend-connect", workspaceId];
}

export async function fetchResendStatus(workspaceId: string) {
  const r = await fetch(`/api/atrako/resend/connect?workspaceId=${workspaceId}&domains=1`);
  return (await r.json()) as Status;
}

/** `embedded`: sem moldura nem cabeçalho — conteúdo dentro de outra linha/painel. */
export function ResendConnectionCard({
  workspaceId,
  embedded = false,
}: {
  workspaceId: string;
  embedded?: boolean;
}) {
  const qc = useQueryClient();
  const key = resendStatusKey(workspaceId);
  const { data, isLoading } = useQuery<Status>({
    queryKey: key,
    queryFn: () => fetchResendStatus(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [domainId, setDomainId] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromLocal, setFromLocal] = useState("contato");
  const [replyTo, setReplyTo] = useState("");
  const [secret, setSecret] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(null);
    }
  }

  function startEdit() {
    setEditing(true);
    setFromName(data?.fromName ?? "");
    setFromLocal(data?.fromEmail?.split("@")[0] ?? "contato");
    setReplyTo(data?.replyTo ?? "");
    setDomainId(data?.domainId ?? "");
    setDomains(data?.domains ?? null);
  }

  const domainOptions = (domains ?? data?.domains ?? []).map((d) => ({
    value: d.id,
    label: `${d.name} · ${d.status === "verified" ? "verificado" : d.status}`,
  }));

  const connected = Boolean(data?.connected);
  const verified = data?.domainStatus === "verified";

  return (
    <div
      className={
        embedded ? "" : "rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] p-4"
      }
    >
      {embedded ? null : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[var(--primary)]" />
            <div>
              <p className="type-nav-link text-[var(--ink)]">E-mail (Resend)</p>
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                Envio dos fluxos de relacionamento e campanhas com o domínio da loja.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-muted-48)]" />
          ) : connected ? (
            <span className="flex items-center gap-1 type-fine-print text-[var(--ink-muted-80)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />
              {verified ? "Pronto para enviar" : "Domínio pendente"}
            </span>
          ) : null}
        </div>
      )}

      {connected && !editing ? (
        <div className={`${embedded ? "" : "mt-3 "}space-y-1 type-fine-print text-[var(--ink-muted-80)]`}>
          <p>
            Remetente: <b>{data?.fromName || "—"}</b> &lt;{data?.fromEmail || "sem remetente"}&gt;
          </p>
          <p>
            Domínio: {data?.domain || "—"} ·{" "}
            {verified ? "verificado" : data?.domainStatus || "não escolhido"}
          </p>
          {data?.replyTo ? <p>Respostas vão para: {data.replyTo}</p> : null}
          <p>
            Webhook de eventos:{" "}
            {data?.webhookConfigured
              ? data?.lastWebhookAt
                ? `ativo · último evento ${new Date(data.lastWebhookAt).toLocaleString("pt-BR")}`
                : "configurado · aguardando primeiro evento"
              : "não configurado"}
          </p>
          {data?.warmupDailyCap ? (
            <p className="text-[var(--ink-muted-48)]">
              Aquecimento do domínio: até {data.warmupDailyCap.toLocaleString("pt-BR")} e-mails/dia
              de campanha por enquanto (fluxos automáticos não entram no teto).
            </p>
          ) : null}
          {data?.domainsError ? (
            <p className="text-[var(--danger)]">Resend: {data.domainsError}</p>
          ) : null}

          {!data?.webhookConfigured ? (
            <div className="mt-2 space-y-2 rounded-[var(--radius-xs)] bg-[var(--surface-pearl)] p-3">
              <p>
                Crie o webhook automaticamente ou, no painel do Resend, cadastre a URL{" "}
                <code className="break-all">{data?.webhookUrl}</code> e cole o signing secret.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy !== null}
                  onClick={() =>
                    run("hook", async () => {
                      await post({ workspaceId, action: "create-webhook" });
                      setNotice("Webhook criado.");
                      await refresh();
                    })
                  }
                >
                  {busy === "hook" ? "Criando…" : "Criar webhook"}
                </button>
                <input
                  className={`${inputCls} max-w-xs`}
                  placeholder="whsec_…"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
                <button
                  type="button"
                  className={btnOutline}
                  disabled={busy !== null || !secret}
                  onClick={() =>
                    run("secret", async () => {
                      await post({ workspaceId, action: "webhook-secret", webhookSecret: secret });
                      setSecret("");
                      await refresh();
                    })
                  }
                >
                  Salvar secret
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={btnOutline} onClick={startEdit}>
              Editar
            </button>
            {!verified ? (
              <button
                type="button"
                className={btnOutline}
                disabled={busy !== null}
                onClick={() =>
                  run("refresh", async () => {
                    const r = await post({ workspaceId, action: "refresh" });
                    setNotice(`Status do domínio: ${String(r.domainStatus ?? "não encontrado")}`);
                    await refresh();
                  })
                }
              >
                Verificar domínio de novo
              </button>
            ) : null}
            <input
              className={`${inputCls} max-w-[220px]`}
              placeholder="email para teste"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <button
              type="button"
              className={btnOutline}
              disabled={busy !== null || !testTo}
              onClick={() =>
                run("test", async () => {
                  await post({ workspaceId, action: "test", to: testTo });
                  setNotice("E-mail de teste enviado.");
                })
              }
            >
              {busy === "test" ? "Enviando…" : "Enviar teste"}
            </button>
            <button
              type="button"
              className="type-fine-print text-[var(--danger)]"
              disabled={busy !== null}
              onClick={() =>
                run("disc", async () => {
                  if (!confirm("Desconectar o Resend? Os fluxos de e-mail param.")) return;
                  await post({ workspaceId, action: "disconnect" });
                  await refresh();
                })
              }
            >
              Desconectar
            </button>
          </div>
        </div>
      ) : null}

      {!connected || editing ? (
        <form
          className={`${embedded ? "" : "mt-3 "}space-y-2`}
          onSubmit={(e) => {
            e.preventDefault();
            void run("save", async () => {
              const r = await post({
                workspaceId,
                action: "save",
                apiKey: apiKey || undefined,
                domainId,
                fromName,
                fromLocal,
                replyTo,
              });
              setApiKey("");
              setEditing(false);
              setNotice(
                r.webhookError
                  ? `Salvo. Webhook: ${String(r.webhookError)}`
                  : r.domainStatus === "verified"
                    ? "Resend conectado e pronto."
                    : "Salvo. Verifique o domínio no Resend (DNS) para começar a enviar.",
              );
              await refresh();
            });
          }}
        >
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder={connected ? "Nova API key (deixe vazio para manter)" : "API key (re_…)"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              autoComplete="off"
            />
            <button
              type="button"
              className={btnOutline}
              disabled={!apiKey || busy !== null}
              onClick={() =>
                run("validate", async () => {
                  const r = await post({ workspaceId, action: "validate", apiKey });
                  const list = (r.domains as Domain[]) ?? [];
                  setDomains(list);
                  if (list.length === 1) setDomainId(list[0].id);
                  if (!list.length) setNotice("Nenhum domínio no Resend. Adicione e verifique um domínio.");
                })
              }
            >
              {busy === "validate" ? "…" : "Buscar domínios"}
            </button>
          </div>
          {domainOptions.length ? (
            <PillSelect
              size="field"
              value={domainId}
              onChange={setDomainId}
              options={[{ value: "", label: "Escolha o domínio" }, ...domainOptions]}
              aria-label="Domínio"
            />
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={inputCls}
              placeholder="Nome do remetente (ex.: Loja X)"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
            <div className="flex items-center gap-1">
              <input
                className={inputCls}
                placeholder="contato"
                value={fromLocal}
                onChange={(e) => setFromLocal(e.target.value)}
              />
              <span className="type-fine-print text-[var(--ink-muted-48)]">
                @
                {(domains ?? data?.domains ?? []).find((d) => d.id === domainId)?.name ?? "domínio"}
              </span>
            </div>
          </div>
          <input
            className={inputCls}
            placeholder="Responder para (opcional, ex.: atendimento@loja.com.br)"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
          />
          <p className="type-micro-legal text-[var(--ink-muted-48)]">
            O rastreio de cliques do Resend é desligado — os cliques passam pelo link do Atrako
            para atribuir vendas. A API key fica criptografada.
          </p>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary} disabled={busy !== null}>
              {busy === "save" ? "Salvando…" : "Salvar"}
            </button>
            {editing ? (
              <button type="button" className={btnOutline} onClick={() => setEditing(false)}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="mt-2 flex items-center gap-1 type-fine-print text-[var(--danger)]">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      ) : null}
      {notice ? <p className="mt-2 type-fine-print text-[var(--ink-muted-80)]">{notice}</p> : null}
    </div>
  );
}
