"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ATRAKO_GREETING,
  atrakoOpeningSuggestions,
  humanizeToolResponse,
  structureAwareReplyFromQuestion,
} from "./agentChatHelpers";

type Tool = { name: string; description: string; risk: string };
type Message = { role: "user" | "assistant"; content: string };

function inferTool(question: string): string {
  const normalized = question.toLocaleLowerCase();
  if (/whatsapp|mensagem|aniversário|aniversario|abandono|recupera/.test(normalized)) {
    return "automations.send_whatsapp";
  }
  if (/formulário|formulario|typeform|quiz|qualifica/.test(normalized)) return "forms.create_draft";
  if (/landing|página|pagina|lp|checkout|oferta/.test(normalized)) return "pages.create_draft";
  if (/publicar formulário|publicar formulario/.test(normalized)) return "forms.publish";
  if (/publicar|publique/.test(normalized)) return "pages.publish";
  if (/lead|crm|funil/.test(normalized)) return "crm.leads_search";
  return "analytics.funnel_summary";
}

export default function AgentConsole() {
  const [question, setQuestion] = useState("");
  const [tools, setTools] = useState<Tool[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [thinkMode, setThinkMode] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    toolName: string;
    input: Record<string, unknown>;
  } | null>(null);

  const suggestions = useMemo(() => atrakoOpeningSuggestions(), []);
  const toolNames = useMemo(() => new Set(tools.map((t) => t.name)), [tools]);
  const hasThread = messages.length > 0;

  useEffect(() => {
    fetch("/api/atrako/agent")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { tools?: Tool[] };
        setTools(data.tools ?? []);
      })
      .catch(() => undefined);
  }, []);

  async function runAgent(toolName: string, toolInput: Record<string, unknown>, confirmed = false) {
    const response = await fetch("/api/atrako/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: "guest",
        toolName,
        input: { ...toolInput, thinkMode },
        previewOnly: !confirmed,
        confirmed,
      }),
    });
    const data = (await response.json()) as {
      plan?: {
        status: string;
        reason?: string;
        tool?: Tool | null;
        preview?: Record<string, unknown>;
      };
      execution?: { status: string; result?: Record<string, unknown> };
      error?: string;
    };
    if (!response.ok || !data.plan) {
      throw new Error(data.error ?? "Não consegui responder agora.");
    }
    return data;
  }

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setQuestion("");
    setMessages((current) => [...current, { role: "user", content: trimmed }]);

    try {
      if (/^confirmar$/i.test(trimmed) && pendingConfirmation) {
        const data = await runAgent(pendingConfirmation.toolName, pendingConfirmation.input, true);
        setPendingConfirmation(null);
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: humanizeToolResponse({
              toolName: pendingConfirmation.toolName,
              status: data.execution?.status ?? data.plan?.status ?? "EXECUTED",
              result: data.execution?.result,
            }),
          },
        ]);
        return;
      }

      const structural = structureAwareReplyFromQuestion(trimmed);
      if (structural) {
        setMessages((current) => [...current, { role: "assistant", content: structural }]);
        return;
      }

      const toolName = inferTool(trimmed);
      if (!toolNames.has(toolName)) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              "Posso ajudar com campanhas, funil, CRM, páginas de venda, formulários, agenda e WhatsApp. O que você quer fazer?",
          },
        ]);
        return;
      }

      const toolInput = { query: trimmed, brief: trimmed };
      const data = await runAgent(toolName, toolInput, false);
      if (data.plan?.status === "NEEDS_CONFIRMATION") {
        setPendingConfirmation({ toolName, input: toolInput });
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: humanizeToolResponse({
            toolName: data.plan?.tool?.name ?? toolName,
            status: data.execution?.status ?? data.plan?.status ?? "READY",
            reason: data.plan?.reason,
            preview: data.plan?.preview,
            result: data.execution?.result,
          }),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Tive um problema agora. Pode tentar de novo?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function Composer() {
    return (
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-3xl"
      >
        <div className="flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3 py-2 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] transition focus-within:border-[var(--hairline)] focus-within:shadow-[0_12px_48px_-12px_rgba(0,0,0,0.16)]">
          <button
            type="button"
            title="Anexar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pergunte qualquer coisa"
            className="min-w-0 flex-1 border-0 bg-transparent py-2.5 type-body text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted-48)]"
            autoFocus
          />

          <button
            type="button"
            onClick={() => setThinkMode((v) => !v)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition ${
              thinkMode
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--canvas-parchment)]"
            }`}
            title="Modo pensar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M9.5 8.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm5 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M4.5 14c1.2 2.8 3.6 4.5 7.5 4.5s6.3-1.7 7.5-4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M8 19.5c.8.7 2.2 1 4 1s3.2-.3 4-1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Pensar
          </button>

          <button
            type="button"
            title="Áudio"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="submit"
            disabled={loading || !question.trim()}
            title="Enviar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? (
              <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-white/80" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="4" y="8" width="3" height="8" rx="1" />
                <rect x="10.5" y="5" width="3" height="14" rx="1" />
                <rect x="17" y="9" width="3" height="6" rx="1" />
              </svg>
            )}
          </button>
        </div>
      </form>
    );
  }

  if (!hasThread) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[var(--canvas-parchment)]">
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24 pt-14 md:pt-0">
          <h1 className="mb-8 text-center type-tagline text-[var(--ink-muted-80)]">
            Como posso ajudar você hoje?
          </h1>
          <Composer />
          <div className="mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
            {suggestions.slice(0, 4).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setQuestion(item)}
                className="rounded-full border border-[var(--hairline)] bg-white px-3.5 py-1.5 type-fine-print text-[var(--ink-muted-48)] transition hover:bg-[var(--surface-pearl)] hover:text-[var(--ink-muted-80)]"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <p className="sr-only">{ATRAKO_GREETING}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas-parchment)]">
      <header className="flex h-14 shrink-0 items-center justify-end border-b border-[var(--divider-soft)] px-4 md:px-6">
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setPendingConfirmation(null);
            setQuestion("");
          }}
          className="type-caption text-[var(--ink-muted-48)] hover:text-[var(--ink)]"
        >
          Nova conversa
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 overflow-y-auto px-4 py-8">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[var(--canvas-parchment)] px-4 py-3 type-body text-[var(--ink)]"
                : "max-w-[92%] whitespace-pre-wrap type-body text-[var(--ink)]"
            }
          >
            {message.role === "assistant" ? (
              <p className="mb-2 type-fine-print text-[var(--ink-muted-48)]">Atrako</p>
            ) : null}
            {message.content}
          </div>
        ))}
        {loading ? (
          <p className="type-caption text-[var(--ink-muted-48)]">Atrako está pensando…</p>
        ) : null}
      </div>

      <div className="sticky bottom-0 bg-[var(--canvas)] px-4 pb-6 pt-2">
        <Composer />
      </div>
    </div>
  );
}
