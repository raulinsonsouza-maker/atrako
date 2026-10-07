"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { TextField } from "@/components/ui/text-field";
import {
  AI_PROVIDERS,
  DEFAULT_AI_MODEL,
  findAiProvider,
  type AiProviderId,
} from "@/lib/atrako-agent/providers";
import { ConfigPage, ConfigSection, SaveButton, StatusBadge, useConfigWorkspace, workspaceConfigKey } from "../_components";

type AiStatus = {
  connected: boolean;
  provider: AiProviderId;
  model: string;
  baseUrl: string | null;
  keyHint: string | null;
  testedAt: string | null;
  platformAi: boolean;
  canManage: boolean;
};

const CUSTOM_MODEL = "__custom__";

function aiConfigKey(workspaceId: string | null | undefined) {
  return ["ai-config", workspaceId] as const;
}

export default function ConfigIaPage() {
  const qc = useQueryClient();
  const { workspaceId } = useConfigWorkspace();
  const { data: status, isLoading } = useQuery({
    queryKey: aiConfigKey(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/ai-config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("Não foi possível carregar");
      return (await r.json()) as AiStatus;
    },
    enabled: Boolean(workspaceId),
  });

  const [provider, setProvider] = useState<AiProviderId>("openai");
  const [modelChoice, setModelChoice] = useState(DEFAULT_AI_MODEL);
  const [customModel, setCustomModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<"test" | "save" | "remove" | null>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const providerDef = findAiProvider(provider) ?? AI_PROVIDERS[0];

  useEffect(() => {
    if (!status) return;
    const def = findAiProvider(status.provider) ?? AI_PROVIDERS[0];
    setProvider(def.id);
    const known = def.models.some((m) => m.value === status.model);
    setModelChoice(known ? status.model : CUSTOM_MODEL);
    setCustomModel(known ? "" : status.model);
    setBaseUrl(def.id === "custom" ? status.baseUrl ?? "" : "");
    setApiKey("");
  }, [status]);

  const modelOptions = useMemo(
    () => [...providerDef.models, { value: CUSTOM_MODEL, label: "Outro modelo…" }],
    [providerDef],
  );
  const model = modelChoice === CUSTOM_MODEL ? customModel.trim() : modelChoice;
  const canManage = status?.canManage ?? false;

  function dirty() {
    setSaved(false);
    setMessage(null);
  }

  function changeProvider(next: string) {
    const def = findAiProvider(next) ?? AI_PROVIDERS[0];
    setProvider(def.id);
    setModelChoice(def.models[0]?.value ?? CUSTOM_MODEL);
    setCustomModel("");
    dirty();
  }

  async function submit(action: "test" | "save") {
    if (!workspaceId) return;
    setBusy(action);
    setMessage(null);
    try {
      const r = await fetch("/api/atrako/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action, provider, model, baseUrl, apiKey }),
      });
      const j = (await r.json().catch(() => ({}))) as Partial<AiStatus> & { error?: string };
      if (!r.ok) throw new Error(j.error || "Não foi possível validar a IA.");
      if (action === "test") {
        setMessage({ tone: "ok", text: "Conexão funcionando. Salve para o Atrako usar esta IA." });
      } else {
        qc.setQueryData(aiConfigKey(workspaceId), j);
        await qc.invalidateQueries({ queryKey: workspaceConfigKey(workspaceId) });
        setSaved(true);
        setMessage({ tone: "ok", text: "IA conectada. O Atrako já está usando este modelo." });
      }
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Falha ao validar." });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!workspaceId) return;
    setBusy("remove");
    try {
      const r = await fetch(`/api/atrako/ai-config?workspaceId=${workspaceId}`, { method: "DELETE" });
      if (r.ok) {
        qc.setQueryData(aiConfigKey(workspaceId), await r.json());
        await qc.invalidateQueries({ queryKey: workspaceConfigKey(workspaceId) });
        setMessage(null);
      }
    } finally {
      setBusy(null);
    }
  }

  const connected = status?.connected ?? false;

  return (
    <ConfigPage
      title="IA"
      loading={isLoading}
      actions={
        canManage ? (
          <SaveButton form="ia-form" saving={busy === "save"} saved={saved} disabled={!model || busy !== null} />
        ) : null
      }
    >
      <form
        id="ia-form"
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit("save");
        }}
      >
        <ConfigSection
          title="Sua IA"
          description={
            status?.platformAi
              ? "O Atrako já funciona com a IA dele. Se você conectar a sua conta de IA, ela passa a responder primeiro — e a do Atrako fica de reserva. A chave fica criptografada e nunca é exibida de novo."
              : "O Atrako usa o modelo e a chave da sua conta de IA para analisar seus dados e montar o que você pedir. A chave fica criptografada e nunca é exibida de novo."
          }
          aside={
            <StatusBadge active={connected || Boolean(status?.platformAi)}>
              {connected ? "Conectada" : status?.platformAi ? "Usando a IA do Atrako" : "Não configurada"}
            </StatusBadge>
          }
        >
          <div className="space-y-2">
            <span className="type-caption-strong text-[var(--ink)]">Provedor</span>
            <PillSelect
              size="field"
              value={provider}
              onChange={changeProvider}
              options={AI_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
              aria-label="Provedor de IA"
              disabled={!canManage}
            />
          </div>

          {provider === "custom" ? (
            <TextField
              label="URL base da API"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                dirty();
              }}
              placeholder="https://api.seuprovedor.com/v1"
              hint="Precisa ser compatível com a API de chat da OpenAI e suportar ferramentas (function calling)."
              disabled={!canManage}
            />
          ) : null}

          <div className="space-y-2">
            <span className="type-caption-strong text-[var(--ink)]">Modelo</span>
            {providerDef.models.length > 0 ? (
              <PillSelect
                size="field"
                value={modelChoice}
                onChange={(v) => {
                  setModelChoice(v);
                  dirty();
                }}
                options={modelOptions}
                aria-label="Modelo"
                disabled={!canManage}
              />
            ) : null}
          </div>
          {modelChoice === CUSTOM_MODEL || providerDef.models.length === 0 ? (
            <TextField
              label="Nome do modelo"
              value={customModel}
              onChange={(e) => {
                setCustomModel(e.target.value);
                setModelChoice(CUSTOM_MODEL);
                dirty();
              }}
              placeholder="ex.: gpt-4.1-mini"
              disabled={!canManage}
            />
          ) : null}
          {provider === "nvidia" ? (
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              Chaves gratuitas da NVIDIA são para teste (limite de uso; modelos podem ser descontinuados).
            </p>
          ) : null}

          <TextField
            label="Chave de API"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              dirty();
            }}
            placeholder={status?.keyHint ? `${status.keyHint} (salva)` : providerDef.keyPlaceholder}
            hint={status?.keyHint ? "Já configurada. Deixe em branco para manter a chave atual." : undefined}
            disabled={!canManage}
          />

          {canManage ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="toolbar"
                disabled={!model || busy !== null}
                onClick={() => void submit("test")}
              >
                {busy === "test" ? "Testando…" : "Testar conexão"}
              </Button>
              {connected ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="!px-0 type-fine-print !text-[var(--danger)]"
                  disabled={busy !== null}
                  onClick={() => void remove()}
                >
                  {busy === "remove" ? "Removendo…" : "Desconectar IA"}
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              Só donos e administradores do workspace podem alterar a IA.
            </p>
          )}

          {message ? (
            <p
              className={`type-caption ${
                message.tone === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"
              }`}
              role="status"
            >
              {message.text}
            </p>
          ) : null}
        </ConfigSection>
      </form>
    </ConfigPage>
  );
}
