"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import { BackLink } from "@/components/ui/back-link";
import { PillSelect } from "@/components/ui/pill-select";
import { ChatPhone } from "./phone/ChatPhone";
import { RadioOption, TagChip, WizardLayout, wizardInputCls, wizardTextareaCls } from "./wizard-ui";

const SUGGESTED = ["preço", "orçamento", "catálogo"];

const DEFAULT_REPLY = "Olá! Que bom receber seu contato. Como podemos ajudar?";

const ACTIONS = [
  { value: "reply", label: "Enviar outra mensagem" },
  { value: "link", label: "Abrir um link" },
  { value: "handoff", label: "Encaminhar para a equipe" },
];

export type DirectButton = {
  label: string;
  action: "reply" | "link" | "handoff";
  text: string;
  url: string;
};

export type DirectDmInitial = {
  fluxoId: string;
  nome?: string;
  anyKeyword?: boolean;
  keywords?: string[];
  replyText?: string;
  buttons?: DirectButton[];
};

function emptyButton(): DirectButton {
  return { label: "", action: "reply", text: "", url: "" };
}

export function DirectDmWizard({
  defaultName = "Mensagem recebida no Direct",
  initial,
  onCancel,
  onSaved,
  username = "seu_perfil",
  workspaceId,
}: {
  defaultName?: string;
  initial?: DirectDmInitial;
  onCancel: () => void;
  onSaved: (fluxoId: string) => void;
  username?: string;
  workspaceId?: string;
}) {
  const [nome] = useState(initial?.nome?.trim() || defaultName);
  const seedKeywords = initial?.keywords?.length ? initial.keywords : [];
  const [anyKeyword, setAnyKeyword] = useState(initial?.anyKeyword !== false);
  const [keywords, setKeywords] = useState<string[]>(seedKeywords);
  const [keywordInput, setKeywordInput] = useState(seedKeywords.join(", "));
  const [replyText, setReplyText] = useState(initial?.replyText?.trim() || DEFAULT_REPLY);
  const [buttons, setButtons] = useState<DirectButton[]>(initial?.buttons?.slice(0, 3) ?? []);
  const [loading, setLoading] = useState(false);

  const handle = username.replace(/^@/, "") || "seu_perfil";
  const previewInbound = anyKeyword ? "Olá" : keywords[0] || keywordInput.split(",")[0]?.trim() || "…";

  function parseKeywords(raw: string) {
    return raw
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  function addSuggested(word: string) {
    const next = parseKeywords(`${keywordInput}${keywordInput.trim() ? ", " : ""}${word}`);
    setKeywords(next);
    setKeywordInput(next.join(", "));
  }

  function patchButton(index: number, patch: Partial<DirectButton>) {
    setButtons((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function activate() {
    if (!nome.trim()) {
      alert("Digite um nome");
      return;
    }
    if (!replyText.trim()) {
      alert("Escreva a mensagem");
      return;
    }
    if (!anyKeyword && !keywords.length) {
      alert("Informe palavras-chave ou escolha qualquer mensagem");
      return;
    }
    const ready = buttons
      .map((button) => ({
        label: button.label.trim().slice(0, 20),
        action: button.action,
        text: button.text.trim(),
        url: button.url.trim(),
      }))
      .filter((button) => button.label);
    if (ready.some((button) => button.action === "link" && !button.url)) {
      alert("Informe o link do botão");
      return;
    }
    if (ready.some((button) => button.action === "reply" && !button.text)) {
      alert("Escreva a mensagem do botão");
      return;
    }

    setLoading(true);
    try {
      const baseUrl = workspaceId
        ? `/api/symbius/flows?workspaceId=${encodeURIComponent(workspaceId)}`
        : `/api/symbius/flows`;
      const triggerConfig = {
        anyKeyword,
        keywords: anyKeyword ? [] : keywords,
        matchMode: "contains",
        replyText: replyText.trim(),
        buttons: ready,
      };
      const res = await fetch(baseUrl, {
        method: initial?.fluxoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          initial?.fluxoId
            ? {
                id: initial.fluxoId,
                nome: nome.trim(),
                status: "PUBLISHED",
                triggerType: "keyword",
                triggerConfig,
              }
            : {
                nome: nome.trim(),
                template: "keyword",
                messageText: replyText.trim(),
                status: "PUBLISHED",
                triggerConfig,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      onSaved(initial?.fluxoId || data.fluxo.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <div className="space-y-5">
      <BackLink onClick={onCancel}>Automações</BackLink>
      <h1 className="type-tagline text-[var(--ink)]">Quando alguém manda uma mensagem</h1>
      <div className="space-y-2">
        <RadioOption selected={anyKeyword} title="Qualquer mensagem recebida" onClick={() => setAnyKeyword(true)} />
        <RadioOption selected={!anyKeyword} title="Mensagem com palavra-chave" onClick={() => setAnyKeyword(false)}>
          {!anyKeyword ? (
            <div className="space-y-2">
              <input
                value={keywordInput}
                onChange={(e) => {
                  setKeywordInput(e.target.value);
                  setKeywords(parseKeywords(e.target.value));
                }}
                className={wizardInputCls}
                placeholder="preço, orçamento"
              />
              <p className="type-fine-print text-[var(--ink-muted-48)]">Use vírgulas para separar as palavras</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="type-fine-print text-[var(--ink-muted-48)]">Por exemplo:</span>
                {SUGGESTED.map((word) => (
                  <TagChip key={word} onClick={() => addSuggested(word)}>
                    {word}
                  </TagChip>
                ))}
              </div>
            </div>
          ) : null}
        </RadioOption>
      </div>

      <div className="space-y-3">
        <p className="type-body-strong text-[var(--ink)]">A resposta no Direct</p>
        <textarea value={replyText} onChange={(e) => setReplyText(e.target.value.slice(0, 1000))} className={wizardTextareaCls} />
        <p className="text-right type-micro-legal text-[var(--ink-muted-48)]">{replyText.length}</p>
        {buttons.map((button, index) => (
          <div key={index} className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--hairline)] p-3">
            <div className="flex items-center gap-2">
              <input
                value={button.label}
                onChange={(e) => patchButton(index, { label: e.target.value.slice(0, 20) })}
                className={wizardInputCls}
                placeholder="Texto do botão"
              />
              <IconButton size="toolbar" className="text-[var(--danger)]" aria-label={`Excluir botão ${index + 1}`} onClick={() => setButtons((prev) => prev.filter((_, i) => i !== index))}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconButton>
            </div>
            <PillSelect
              size="field"
              aria-label={`Ação do botão ${index + 1}`}
              value={button.action}
              onChange={(value) => patchButton(index, { action: value as DirectButton["action"] })}
              options={ACTIONS}
            />
            {button.action === "reply" ? (
              <textarea
                value={button.text}
                onChange={(e) => patchButton(index, { text: e.target.value })}
                className={wizardTextareaCls}
                placeholder="Mensagem que essa opção envia"
              />
            ) : null}
            {button.action === "link" ? (
              <input
                value={button.url}
                onChange={(e) => patchButton(index, { url: e.target.value })}
                className={wizardInputCls}
                placeholder="https://"
                inputMode="url"
              />
            ) : null}
          </div>
        ))}
        {buttons.length < 3 ? (
          <button type="button" className="type-caption text-[var(--primary)]" onClick={() => setButtons((prev) => [...prev, emptyButton()])}>
            + Adicionar botão
          </button>
        ) : null}
        <p className="type-fine-print text-[var(--ink-muted-48)]">Até 3 botões. O texto de cada um tem no máximo 20 caracteres.</p>
      </div>
    </div>
  );

  return (
    <WizardLayout
      previewHeader={
        <>
          <span className="type-caption text-[var(--ink-muted-48)]">Visualização</span>
          <Button type="button" size="toolbar" disabled={loading} onClick={() => void activate()}>
            {loading ? "Ativando…" : "Ativar"}
          </Button>
        </>
      }
      form={form}
      preview={
        <ChatPhone
          theme="instagram"
          header={{ name: handle, subtitle: "Direct" }}
          items={[
            { kind: "sent", text: previewInbound },
            { kind: "received", text: replyText },
            ...buttons
              .filter((button) => button.label.trim())
              .map((button) => ({
                kind: "action" as const,
                label: button.label.trim(),
                variant: button.action === "link" ? ("link" as const) : ("action" as const),
              })),
          ]}
        />
      }
    />
  );
}
