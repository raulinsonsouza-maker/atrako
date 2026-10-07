"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Menu, MessageSquare, PanelLeft, PanelLeftClose, SquarePen, Trash2 } from "lucide-react";
import {
  Button,
  IconButton,
  OrbComposer,
  SearchInput,
  ThinkingLabel,
  ThinkingOrb,
  useThinkingStep,
  type OrbComposerHandle,
} from "@/components/ui";
import { buttonClass } from "@/components/ui/button";
import { useOpenAppMenu } from "@/components/layout/AppShell";
import { NotificationBell } from "@/components/relacionamento/NotificationBell";
import { AssistantMarkdown, markdownToPlainText } from "./AssistantMarkdown";
import { AssistantRequestError, streamAssistant } from "./assistantStream";
import {
  useAssistantHistory,
  type AssistantConversation,
  type AssistantMessage,
} from "./useAssistantHistory";

type Live = {
  key: string;
  phase: "thinking" | "streaming" | "resolved";
  label: string;
  text: string;
};

const NEW_KEY = "__new__";
const MIN_THINK_MS = 900;
const RESOLVE_HOLD_MS = 520;
const FLY_MS = 620;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isCompactLayout = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1068px)").matches;
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function localMessage(role: AssistantMessage["role"], content: string, status = "COMPLETE"): AssistantMessage {
  return {
    id: `local-${uid()}`,
    role,
    content,
    status,
    createdAt: new Date().toISOString(),
    steps: [],
    pendingAction: null,
    actionStatus: null,
    actionResult: null,
  };
}

/** Bola em `--primary` que sai do enviar e pousa no orb (o "launch" do MorphOrb). */
function flyBall(from: DOMRect, to: DOMRect) {
  const ball = document.createElement("span");
  ball.className = "orb-fly-ball";
  document.body.appendChild(ball);
  const x0 = from.left + from.width / 2;
  const y0 = from.top + from.height / 2;
  const x1 = to.left + to.width / 2;
  const y1 = to.top + to.height / 2;
  const cx = (x0 + x1) / 2 + (x0 > x1 ? 1 : -1) * Math.min(160, Math.abs(y0 - y1) * 0.35);
  const cy = Math.min(y0, y1) - 24;
  const endScale = Math.max(0.6, to.width / 36);
  const frames: Keyframe[] = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const s = 1 + (endScale - 1) * t;
    return {
      offset: t,
      transform: `translate3d(${x - 18}px, ${y - 18}px, 0) scale(${s})`,
      opacity: t < 0.75 ? 1 : 1 - (t - 0.75) * 4,
    };
  });
  ball
    .animate(frames, { duration: FLY_MS, easing: "cubic-bezier(.5,0,.1,1)", fill: "forwards" })
    .finished.catch(() => undefined)
    .finally(() => ball.remove());
}

function groupLabel(iso: string) {
  const ts = new Date(iso).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  if (ts >= today.getTime()) return "Hoje";
  if (ts >= today.getTime() - day) return "Ontem";
  if (ts >= today.getTime() - 7 * day) return "Últimos 7 dias";
  if (ts >= today.getTime() - 30 * day) return "Últimos 30 dias";
  return "Anteriores";
}

const PREVIEW_LABELS: Record<string, string> = {
  tipo: "Tipo",
  nome: "Nome",
  titulo: "Título",
  subtitulo: "Subtítulo",
  beneficios: "Benefícios",
  perguntas: "Perguntas",
  perguntasFrequentes: "Perguntas frequentes",
  botao: "Botão",
  preco: "Preço",
};

function previewValue(key: string, value: unknown) {
  if (key === "preco" && typeof value === "number") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return String(value);
}

function ActionCard({
  message,
  busy,
  onDecide,
}: {
  message: AssistantMessage;
  busy: boolean;
  onDecide: (decision: "confirm" | "cancel") => void;
}) {
  const action = message.pendingAction;
  if (!action) return null;
  const entries = Object.entries(action.preview).filter(
    ([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
  const result = message.actionResult;
  return (
    <div className="assistant-action-card">
      <p className="type-caption-strong text-[var(--ink)]">{action.summary}</p>
      <dl className="assistant-action-preview">
        {entries.map(([k, v]) => (
          <div key={k} className="assistant-action-row">
            <dt className="type-fine-print text-[var(--ink-muted-48)]">{PREVIEW_LABELS[k] ?? k}</dt>
            <dd className="type-caption text-[var(--ink)]">
              {Array.isArray(v) ? (
                <ul className="assistant-md-ul">
                  {v.map((item, i) => (
                    <li key={i}>{String(item)}</li>
                  ))}
                </ul>
              ) : (
                previewValue(k, v)
              )}
            </dd>
          </div>
        ))}
      </dl>
      {message.actionStatus === "pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="toolbar" disabled={busy} onClick={() => onDecide("confirm")}>
            {busy ? "Criando…" : "Criar rascunho"}
          </Button>
          <Button type="button" size="toolbar" variant="outline" disabled={busy} onClick={() => onDecide("cancel")}>
            Agora não
          </Button>
          <span className="type-fine-print text-[var(--ink-muted-48)]">Nada é publicado sem você.</span>
        </div>
      ) : message.actionStatus === "confirmed" && result ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="type-fine-print text-[var(--ink-muted-80)]">Rascunho criado</span>
          <Link href={result.editPath} className={buttonClass({ variant: "outline", size: "toolbar" })}>
            Abrir para revisar
          </Link>
        </div>
      ) : message.actionStatus === "cancelled" ? (
        <p className="type-fine-print text-[var(--ink-muted-48)]">Cancelado — nada foi criado.</p>
      ) : message.actionStatus === "failed" ? (
        <p className="type-fine-print text-[var(--danger)]">Não foi possível criar. Tente pedir de novo.</p>
      ) : null}
    </div>
  );
}

function BotMessage({
  message,
  fresh,
  deciding,
  onDecide,
}: {
  message: AssistantMessage;
  fresh: boolean;
  deciding: boolean;
  onDecide: (decision: "confirm" | "cancel") => void;
}) {
  const consulted = [
    ...new Set(
      message.steps
        .filter((s) => s.coverage !== "error" && !s.tool.startsWith("criar_"))
        .map((s) => s.source ?? s.label),
    ),
  ];
  return (
    <div className={`assistant-msg-bot${fresh ? " assistant-msg-fresh" : ""}`}>
      <span className="assistant-avatar" aria-hidden>
        <i />
      </span>
      <div className="min-w-0">
        <p className="assistant-msg-name type-fine-print">Atrako</p>
        <div
          className={`assistant-msg-body type-body${message.status === "ERROR" ? " text-[var(--ink-muted-80)]" : ""}`}
        >
          <AssistantMarkdown text={message.content} />
        </div>
        <ActionCard message={message} busy={deciding} onDecide={onDecide} />
        {consulted.length ? (
          <p className="assistant-msg-sources type-fine-print">Consultei: {consulted.join(" · ")}</p>
        ) : null}
      </div>
    </div>
  );
}

function HistoryPanel({
  conversations,
  activeId,
  hydrated,
  collapsed,
  mobileOpen,
  onSelect,
  onNew,
  onRemove,
  onCollapse,
  onCloseMobile,
}: {
  conversations: AssistantConversation[];
  activeId: string | null;
  hydrated: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
  onCollapse: () => void;
  onCloseMobile: () => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const list = q ? conversations.filter((c) => c.title.toLocaleLowerCase().includes(q)) : conversations;
    const out: { label: string; items: AssistantConversation[] }[] = [];
    for (const c of list) {
      const label = groupLabel(c.updatedAt);
      const group = out.find((g) => g.label === label);
      if (group) group.items.push(c);
      else out.push({ label, items: [c] });
    }
    return out;
  }, [conversations, query]);

  return (
    <>
      <div
        className="assistant-history-backdrop"
        data-open={mobileOpen || undefined}
        onClick={onCloseMobile}
        aria-hidden
      />
      <aside
        className="assistant-history"
        data-collapsed={collapsed || undefined}
        data-open={mobileOpen || undefined}
        aria-label="Histórico de conversas"
      >
        <div className="assistant-history-inner">
          <div className="assistant-history-head">
            <span className="type-caption-strong text-[var(--ink)]">Conversas</span>
            <div className="flex items-center gap-1">
              <IconButton size="toolbar" onClick={onNew} aria-label="Nova conversa" title="Nova conversa">
                <SquarePen className="h-4 w-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton
                size="toolbar"
                onClick={() => (isCompactLayout() ? onCloseMobile() : onCollapse())}
                aria-label="Recolher histórico"
                title="Recolher histórico"
              >
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
              </IconButton>
            </div>
          </div>

          <div className="px-3 pb-2">
            <SearchInput
              size="toolbar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversas"
              aria-label="Buscar conversas"
            />
          </div>

          <nav className="assistant-history-list">
            {!hydrated ? (
              <div className="space-y-2 px-2 pt-2" aria-hidden>
                {[72, 56, 64].map((w) => (
                  <span key={w} className="assistant-history-skeleton" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="assistant-history-empty">
                <MessageSquare className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                <p className="type-caption">
                  {query ? "Nada encontrado." : "Suas conversas com o Atrako aparecem aqui."}
                </p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="assistant-history-group">
                  <p className="assistant-history-group-label type-fine-print">{group.label}</p>
                  {group.items.map((c) => (
                    <div key={c.id} className="assistant-history-item" data-active={c.id === activeId || undefined}>
                      <button type="button" className="assistant-history-item-main" onClick={() => onSelect(c.id)}>
                        <span className="type-caption block truncate text-[var(--ink)]">{c.title}</span>
                      </button>
                      <button
                        type="button"
                        className="assistant-history-item-remove"
                        onClick={() => onRemove(c.id)}
                        aria-label={`Apagar conversa ${c.title}`}
                        title="Apagar"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </nav>
        </div>
      </aside>
    </>
  );
}

export default function AgentConsole() {
  const history = useAssistantHistory();
  const { active, activeId, ai } = history;
  const openAppMenu = useOpenAppMenu();
  const [question, setQuestion] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  const [deciding, setDeciding] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [flying, setFlying] = useState(false);

  const composerRef = useRef<OrbComposerHandle>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const pendingOrbRef = useRef<HTMLDivElement>(null);
  const flyFromRef = useRef<DOMRect | null>(null);
  const liveRegionRef = useRef<HTMLParagraphElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const viewKey = activeId ?? NEW_KEY;
  const messages = history.messagesFor(viewKey);
  const liveHere = live && live.key === viewKey ? live : null;
  const hasThread = messages.length > 0 || !!liveHere;
  const orbStep = useThinkingStep(liveHere?.phase === "thinking");
  const aiMissing = history.hydrated && ai !== null && !ai.ready;

  useEffect(() => () => abortRef.current?.abort(), []);

  /* Nova pergunta: desce o fio na hora e lança a bola do enviar até o orb. */
  useLayoutEffect(() => {
    if (liveHere?.phase !== "thinking") return;
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
    const from = flyFromRef.current;
    flyFromRef.current = null;
    const to = pendingOrbRef.current?.getBoundingClientRect();
    if (!from || !to || prefersReducedMotion()) return;
    flyBall(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveHere?.phase, liveHere?.key]);

  useEffect(() => {
    if (!flying) return;
    const id = window.setTimeout(() => setFlying(false), FLY_MS);
    return () => window.clearTimeout(id);
  }, [flying]);

  /* Texto chegando: acompanha o fim do fio. */
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 160;
    if (liveHere?.phase === "streaming" && nearBottom) thread.scrollTop = thread.scrollHeight;
  }, [liveHere?.text, liveHere?.phase]);

  /* Resposta concluída: rolagem suave até o fim. */
  useEffect(() => {
    const thread = threadRef.current;
    if (!thread || liveHere) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages.length, liveHere]);

  /* Troca de conversa: abre no fim, sem animação. */
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [activeId, history.loadingMessages]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || live || aiMissing) return;

    let key = viewKey;
    const optimistic = localMessage("user", text);
    history.setMessages(key, (list) => [...list, optimistic]);
    flyFromRef.current = composerRef.current?.sendRect() ?? null;
    setFlying(!!flyFromRef.current && !prefersReducedMotion());
    setQuestion("");
    setLive({ key, phase: "thinking", label: "Pensando", text: "" });
    if (liveRegionRef.current) liveRegionRef.current.textContent = "Atrako está pensando…";

    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = performance.now();
    let streamed = false;
    let final: AssistantMessage | null = null;

    try {
      await streamAssistant(
        { message: text, conversationId: activeId, clientRequestId: uid() },
        {
          onMeta: ({ conversation, userMessage }) => {
            history.upsertConversation(conversation);
            if (key === NEW_KEY) {
              history.moveMessages(NEW_KEY, conversation.id);
              key = conversation.id;
              history.setActiveId(conversation.id);
              setLive((cur) => (cur ? { ...cur, key: conversation.id } : cur));
            }
            history.setMessages(key, (list) => list.map((m) => (m.id === optimistic.id ? userMessage : m)));
          },
          onStep: ({ label }) => {
            streamed = false;
            setLive((cur) => (cur ? { ...cur, phase: "thinking", label, text: "" } : cur));
          },
          onToken: (t) => {
            streamed = true;
            setLive((cur) => (cur ? { ...cur, phase: "streaming", text: cur.text + t } : cur));
          },
          onDiscard: () => {
            streamed = false;
            setLive((cur) => (cur ? { ...cur, phase: "thinking", text: "" } : cur));
          },
          onDone: ({ message, conversation }) => {
            final = message;
            history.upsertConversation(conversation);
          },
          onError: ({ message, failed }) => {
            final = failed ?? localMessage("assistant", message, "ERROR");
          },
        },
        controller.signal,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof AssistantRequestError && error.code === "ai_not_configured") void history.refreshAi();
      final = localMessage(
        "assistant",
        error instanceof Error ? error.message : "Tive um problema agora. Pode tentar de novo?",
        "ERROR",
      );
    } finally {
      abortRef.current = null;
    }

    const reply: AssistantMessage = final ?? localMessage("assistant", "A conexão caiu antes da resposta. Tente de novo.", "ERROR");
    if (!streamed) {
      await wait(MIN_THINK_MS - (performance.now() - startedAt));
      setLive((cur) => (cur ? { ...cur, phase: "resolved" } : cur));
      await wait(prefersReducedMotion() ? 0 : RESOLVE_HOLD_MS);
      setFreshIds((cur) => new Set(cur).add(reply.id));
    }
    history.setMessages(key, (list) => [...list, reply]);
    setLive(null);
    if (liveRegionRef.current) liveRegionRef.current.textContent = markdownToPlainText(reply.content);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function decide(message: AssistantMessage, decision: "confirm" | "cancel") {
    if (!activeId || deciding) return;
    setDeciding(message.id);
    try {
      const r = await fetch("/api/atrako/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, messageId: message.id, decision }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        message?: AssistantMessage;
        followUp?: AssistantMessage;
        error?: string;
      };
      if (!r.ok || !data.message) {
        history.setMessages(activeId, (list) => [
          ...list,
          localMessage("assistant", data.error ?? "Não consegui concluir agora.", "ERROR"),
        ]);
        return;
      }
      const updated = data.message;
      const followUp = data.followUp;
      history.setMessages(activeId, (list) => [
        ...list.map((m) => (m.id === updated.id ? updated : m)),
        ...(followUp ? [followUp] : []),
      ]);
      if (followUp) setFreshIds((cur) => new Set(cur).add(followUp.id));
    } finally {
      setDeciding(null);
    }
  }

  function startNew() {
    history.startNew();
    setQuestion("");
    setMobileOpen(false);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  function openHistory() {
    if (isCompactLayout()) setMobileOpen(true);
    else setCollapsed((c) => !c);
  }

  const composer = (
    <OrbComposer
      ref={composerRef}
      value={question}
      onValueChange={setQuestion}
      onSubmit={send}
      busy={!!live}
      placeholder="Pergunte ao Atrako"
      autoFocus
    />
  );

  const setupCta = (
    <div className="assistant-setup">
      <p className="type-body text-[var(--ink-muted-80)]">
        Para eu analisar seus dados, conecte a sua IA. Uso o modelo e a chave da sua conta — a chave fica
        criptografada.
      </p>
      {ai?.canManage ? (
        <Link href="/config/ia" className={buttonClass({ variant: "primary" })}>
          Conectar IA
        </Link>
      ) : (
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          Peça a um administrador do workspace para conectar a IA em Config → IA.
        </p>
      )}
    </div>
  );

  return (
    <div className="assistant-shell">
      <HistoryPanel
        conversations={history.conversations}
        activeId={activeId}
        hydrated={history.hydrated}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onSelect={(id) => {
          void history.select(id);
          setMobileOpen(false);
          window.requestAnimationFrame(() => composerRef.current?.focus());
        }}
        onNew={startNew}
        onRemove={(id) => void history.remove(id)}
        onCollapse={() => setCollapsed(true)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <section className="assistant-stage">
        <header className="assistant-stage-head">
          <div className="assistant-stage-head-side">
            <IconButton size="toolbar" className="md:hidden" onClick={openAppMenu} aria-label="Abrir menu">
              <Menu className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
            <IconButton
              size="toolbar"
              onClick={openHistory}
              className={collapsed ? undefined : "desktop:hidden"}
              aria-label="Histórico de conversas"
              title="Histórico de conversas"
            >
              <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
          </div>
          <span className="assistant-stage-title type-caption-strong">{hasThread ? active?.title ?? "" : ""}</span>
          <div className="assistant-stage-head-side assistant-stage-head-end">
            <NotificationBell />
            {hasThread ? (
              <IconButton size="toolbar" onClick={startNew} aria-label="Nova conversa" title="Nova conversa">
                <SquarePen className="h-4 w-4" strokeWidth={1.75} />
              </IconButton>
            ) : null}
          </div>
        </header>

        {hasThread ? (
          <>
            <div ref={threadRef} className="assistant-thread">
              <div key={activeId ?? "new"} className="assistant-thread-inner">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="assistant-msg-user type-body">
                      {message.content}
                    </div>
                  ) : (
                    <BotMessage
                      key={message.id}
                      message={message}
                      fresh={freshIds.has(message.id)}
                      deciding={deciding === message.id}
                      onDecide={(d) => void decide(message, d)}
                    />
                  ),
                )}

                {liveHere?.phase === "streaming" ? (
                  <div className="assistant-msg-bot">
                    <span className="assistant-avatar" aria-hidden>
                      <i />
                    </span>
                    <div className="min-w-0">
                      <p className="assistant-msg-name type-fine-print">Atrako</p>
                      <div className="assistant-msg-body type-body" aria-busy>
                        <AssistantMarkdown text={liveHere.text} />
                        <span className="assistant-caret" aria-hidden />
                      </div>
                    </div>
                  </div>
                ) : liveHere ? (
                  <div className="assistant-thinking">
                    <ThinkingOrb
                      ref={pendingOrbRef}
                      size={44}
                      state={liveHere.phase === "resolved" ? "resolved" : "thinking"}
                      step={orbStep}
                      assembleDelay={flying ? FLY_MS - 160 : 0}
                    />
                    <ThinkingLabel labels={[liveHere.label]} step={0} done={liveHere.phase === "resolved"} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="assistant-dock">
              <div className="assistant-dock-inner">{aiMissing ? setupCta : composer}</div>
            </div>
          </>
        ) : (
          <div className="assistant-hero">
            <ThinkingOrb size={132} state="idle" className="assistant-hero-orb" />
            <h1 className="assistant-hero-title type-tagline">Olá, eu sou o Atrako</h1>
            <p className="assistant-hero-lead type-body">
              {aiMissing ? "Seu especialista em vendas, dados e jornada." : "Como posso te ajudar hoje?"}
            </p>
            <div className="assistant-hero-composer">{aiMissing ? setupCta : composer}</div>
          </div>
        )}
      </section>

      <p ref={liveRegionRef} className="sr-only" role="status" aria-live="polite" />
    </div>
  );
}
