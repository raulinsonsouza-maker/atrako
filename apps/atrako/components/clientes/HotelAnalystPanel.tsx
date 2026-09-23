"use client";

import React from "react";
import { splitMarkdownTableRow } from "@/lib/analyst/markdown";
import {
  ArrowDown,
  BarChart3,
  Check,
  ChevronLeft,
  Clock3,
  Database,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";

type Conversation = { id: string; title: string; createdAt: string; updatedAt: string };
type Source = {
  tool: string;
  label: string;
  period: { start: string; end: string };
  coverage?: string;
  limitations?: string;
};
type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  status: "COMPLETE" | "ERROR" | "PROCESSING";
  sources?: Source[];
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostMicros?: number;
  retryQuestion?: string;
  retryIntentToken?: string;
  retryStart?: string;
  retryEnd?: string;
  contextQuestion?: string;
  createdAt: string;
};

type Props = {
  clienteId: string;
  filter: { dataInicio?: string; dataFim?: string };
  channel: string;
  comparisonPreset: string;
};

function apiHeaders() {
  return { "Content-Type": "application/json" };
}

function formatDate(value?: string) {
  if (!value) return "—";
  const localDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = localDate
    ? new Date(Number(localDate[1]), Number(localDate[2]) - 1, Number(localDate[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function parseError(response: Response, json: { error?: string }) {
  if (response.status === 401) return "Faça login para usar o InPilot.";
  if (response.status === 403) return "Seu usuário não tem acesso ao InPilot.";
  return json.error || "Não foi possível concluir esta ação.";
}

async function readJson(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    return {};
  }
}

function InPilotMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dimensions = size === "lg" ? "h-14 w-14 rounded-2xl" : size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center border border-[#f1a06e]/45 bg-[#e87932] text-[#1b110c] shadow-[0_5px_18px_rgba(232,121,50,.16)] ${dimensions}`} role="img" aria-label="Robô InPilot">
      <svg viewBox="0 0 48 48" className="h-[72%] w-[72%]" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 8v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="6" r="2" fill="currentColor" />
        <rect x="8" y="14" width="32" height="24" rx="8" fill="currentColor" opacity=".18" stroke="currentColor" strokeWidth="3" />
        <circle cx="18" cy="25" r="3" fill="currentColor" />
        <circle cx="30" cy="25" r="3" fill="currentColor" />
        <path d="M17 32c4 3 10 3 14 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M8 24H5M40 24h3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function HotelAnalystPanel({ clienteId, filter, channel, comparisonPreset }: Props) {
  const storageKey = `hotel-analyst-active-${clienteId}`;
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [menuId, setMenuId] = React.useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = React.useState(true);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);
  const shouldScrollToBottomRef = React.useRef(true);
  const activeIdRef = React.useRef<string | null>(null);
  const historyRequestRef = React.useRef(0);
  const sendingRef = React.useRef(false);
  const newConversationIdRef = React.useRef<string | null>(null);

  const analystFetch = React.useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, { ...init, headers: { ...apiHeaders(), ...init?.headers } });
    if (response.status === 401) {
      setError("Faça login para usar o InPilot.");
    }
    return response;
  }, []);

  const loadConversations = React.useCallback(async (preferredId?: string | null) => {
    setLoading(true);
    setError("");
    try {
      const response = await analystFetch(`/api/clientes/${clienteId}/analista-hotel`);
      const json = await readJson(response);
      if (!response.ok) throw new Error(parseError(response, json));
      const list = (json.conversations || []) as Conversation[];
      setConversations(list);
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
      const next = preferredId || stored || activeIdRef.current;
      const selected = list.find((item) => item.id === next)?.id || list[0]?.id || null;
      setActiveId(selected);
      activeIdRef.current = selected;
      if (selected && typeof window !== "undefined") window.localStorage.setItem(storageKey, selected);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as conversas.");
    } finally {
      setLoading(false);
    }
  }, [analystFetch, clienteId, storageKey]);

  const loadMessages = React.useCallback(async (conversationId: string, olderCursor?: string | null) => {
    const requestSequence = ++historyRequestRef.current;
    shouldScrollToBottomRef.current = !olderCursor;
    setMessagesLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ conversationId });
      if (olderCursor) query.set("cursor", olderCursor);
      const response = await analystFetch(`/api/clientes/${clienteId}/analista-hotel?${query}`);
      const json = await readJson(response);
      if (!response.ok) throw new Error(parseError(response, json));
      if (activeIdRef.current !== conversationId || historyRequestRef.current !== requestSequence) return;
      const incoming = (json.messages || []) as Message[];
      setMessages((current) => olderCursor ? [...incoming, ...current] : incoming);
      setCursor(json.nextCursor || null);
      setHasMore(Boolean(json.nextCursor));
    } catch (reason) {
      if (activeIdRef.current === conversationId && historyRequestRef.current === requestSequence) {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar as mensagens.");
      }
    } finally {
      if (activeIdRef.current === conversationId && historyRequestRef.current === requestSequence) setMessagesLoading(false);
    }
  }, [analystFetch, clienteId]);

  React.useEffect(() => { void loadConversations(); }, [loadConversations]);
  React.useEffect(() => {
    if (activeId) {
      activeIdRef.current = activeId;
      if (typeof window !== "undefined") window.localStorage.setItem(storageKey, activeId);
      setCursor(null);
      if (newConversationIdRef.current === activeId) {
        newConversationIdRef.current = null;
        setHasMore(false);
      } else {
        setMessages([]);
        void loadMessages(activeId);
      }
    } else {
      activeIdRef.current = null;
      setMessages([]);
    }
  }, [activeId, loadMessages, storageKey]);
  React.useEffect(() => {
    if (!messagesLoading && shouldScrollToBottomRef.current && messagesScrollRef.current) {
      messagesScrollRef.current.scrollTo({
        top: messagesScrollRef.current.scrollHeight,
        behavior: sending ? "smooth" : "auto",
      });
    }
  }, [messages, messagesLoading, sending]);
  React.useEffect(() => {
    if (!activeId || sending || !messages.some((message) => message.status === "PROCESSING" && !message.id.startsWith("pending-"))) return;
    const timer = window.setTimeout(() => { void loadMessages(activeId); }, 2_000);
    return () => window.clearTimeout(timer);
  }, [activeId, loadMessages, messages, sending]);

  async function createConversation(): Promise<Conversation | null> {
    setError("");
    try {
      const response = await analystFetch(`/api/clientes/${clienteId}/analista-hotel`, {
        method: "POST", body: JSON.stringify({ action: "create" }),
      });
      const json = await readJson(response);
      if (!response.ok) throw new Error(parseError(response, json));
      const conversation = json.conversation as Conversation;
      setConversations((current) => [conversation, ...current]);
      activeIdRef.current = conversation.id;
      newConversationIdRef.current = conversation.id;
      setMessages([]);
      setActiveId(conversation.id);
      setMobileListOpen(false);
      return conversation;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a conversa.");
      return null;
    }
  }

  async function renameConversation(id: string) {
    const title = renameValue.trim();
    if (!title) return;
    try {
      const response = await analystFetch(`/api/clientes/${clienteId}/analista-hotel`, {
        method: "PATCH", body: JSON.stringify({ conversationId: id, title }),
      });
      const json = await readJson(response);
      if (!response.ok) throw new Error(parseError(response, json));
      const conversation = json.conversation as Conversation;
      setConversations((current) => current.map((item) => item.id === id ? conversation : item));
      setRenaming(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível renomear a conversa.");
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("Excluir esta conversa e todo o seu histórico?")) return;
    try {
      const response = await analystFetch(`/api/clientes/${clienteId}/analista-hotel?conversationId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await readJson(response);
      if (!response.ok) throw new Error(parseError(response, json));
      const remaining = conversations.filter((item) => item.id !== id);
      setConversations(remaining);
      if (activeId === id) setActiveId(remaining[0]?.id || null);
      setMenuId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir a conversa.");
    }
  }

  async function ask(text: string, retry?: Pick<Message, "retryIntentToken" | "retryStart" | "retryEnd">) {
    const trimmed = text.trim();
    if (!trimmed || loading || sendingRef.current || !filter.dataInicio || !filter.dataFim) return;
    sendingRef.current = true;
    setSending(true);
    shouldScrollToBottomRef.current = true;
    setError("");
    let conversationId = activeIdRef.current;
    if (!conversationId) {
      const created = await createConversation();
      conversationId = created?.id ?? null;
      if (!conversationId) {
        sendingRef.current = false;
        setSending(false);
        return;
      }
    }
    const optimisticId = `pending-${Date.now()}`;
    const optimisticUserId = `question-${optimisticId}`;
    setMessages((current) => [...current,
      { id: optimisticUserId, role: "USER", content: trimmed, status: "COMPLETE", createdAt: new Date().toISOString() },
      { id: optimisticId, role: "ASSISTANT", content: "", contextQuestion: trimmed, status: "PROCESSING", createdAt: new Date().toISOString() },
    ]);
    setQuestion("");
    try {
      const response = await analystFetch(`/api/clientes/${clienteId}/analista-hotel`, {
        method: "POST",
        body: JSON.stringify({
          action: "ask", conversationId, question: trimmed,
          dataInicio: filter.dataInicio, dataFim: filter.dataFim, channel, comparisonPreset,
           retryIntentToken: retry?.retryIntentToken,
           retryStart: retry?.retryStart,
           retryEnd: retry?.retryEnd,
          idempotencyKey: `${clienteId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }),
      });
      const json = await readJson(response);
      if (!response.ok) throw new Error(parseError(response, json));
      const conversation = json.conversation as Conversation;
      const userMessage = json.userMessage as Message | undefined;
      const message = json.message as Message;
      if (activeIdRef.current === conversationId) {
        setMessages((current) => [
          ...current.filter((item) => item.id !== optimisticId && item.id !== optimisticUserId),
          userMessage ?? { id: optimisticUserId, role: "USER", content: trimmed, status: "COMPLETE", createdAt: new Date().toISOString() },
          message,
        ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      }
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
    } catch (reason) {
      if (activeIdRef.current === conversationId) {
        setMessages((current) => current.filter((item) => item.id !== optimisticId && item.id !== optimisticUserId));
        await loadMessages(conversationId);
        setError(reason instanceof Error ? reason.message : "Não foi possível analisar os dados.");
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  const activeConversation = conversations.find((item) => item.id === activeId);
  return (
    <section className="min-h-0 overflow-hidden rounded-[1.5rem] border border-[#3a2b22] bg-[#101114] shadow-[0_24px_80px_rgba(0,0,0,.28)]">
      <div className="flex h-[min(680px,calc(100dvh-190px))] min-h-[440px] flex-col md:flex-row lg:h-[calc(100dvh-190px)] lg:min-h-[480px] lg:max-h-[780px]">
        <aside className={`${mobileListOpen ? "flex" : "hidden"} min-h-0 w-full shrink-0 flex-col border-b border-[#2a2d33] bg-[#151619] md:flex md:w-[250px] md:border-b-0 md:border-r xl:w-[270px]`}>
          <div className="border-b border-[#2a2d33] px-4 py-3">
              <div className="flex items-center justify-between">
               <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#e87932]">InPilot · Inteligência do cliente</p><h2 className="mt-1 text-lg font-bold text-[#f3eee9]">Conversas</h2></div>
              <button onClick={() => void createConversation()} aria-label="Nova conversa" className="rounded-xl border border-[#704024] bg-[#e87932] p-2 text-[#1a100b] transition-transform hover:-translate-y-0.5"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? <div className="space-y-2 p-2">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-[#202126]" />)}</div> :
              conversations.length ? conversations.map((conversation) => (
                <div key={conversation.id} className={`group relative mb-1 rounded-xl border transition-colors ${activeId === conversation.id ? "border-[#6a3c24] bg-[#2a1d17]" : "border-transparent hover:border-[#34353b] hover:bg-[#1e1f23]"}`}>
                  {renaming === conversation.id ? <form onSubmit={(event) => { event.preventDefault(); void renameConversation(conversation.id); }} className="flex gap-1 p-2"><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="min-w-0 flex-1 rounded-md bg-[#0f1012] px-2 py-1 text-xs outline-none ring-1 ring-[#e87932]" /><button aria-label="Salvar nome" className="text-[#e87932]"><Check className="h-4 w-4" /></button><button type="button" aria-label="Cancelar" onClick={() => setRenaming(null)}><X className="h-4 w-4" /></button></form> :
                    <button onClick={() => {
                      if (activeIdRef.current !== conversation.id) {
                        activeIdRef.current = conversation.id;
                        setMessages([]);
                        setActiveId(conversation.id);
                      }
                      setMobileListOpen(false);
                    }} className="w-full p-3 pr-10 text-left">
                      <p className="truncate text-sm font-semibold text-[#eee8e2]">{conversation.title || "Nova análise"}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[#8d8988]"><Clock3 className="h-3 w-3" /> Atualizada {formatDate(conversation.updatedAt)}</p>
                    </button>}
                  {renaming !== conversation.id && <button aria-label={`Opções de ${conversation.title}`} onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)} className="absolute right-2 top-3 rounded-md p-1 text-[#777579] opacity-0 transition-opacity hover:text-[#e87932] group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>}
                  {menuId === conversation.id && <div className="absolute right-2 top-10 z-10 w-32 rounded-lg border border-[#3a3b40] bg-[#242529] p-1 shadow-xl"><button onClick={() => { setRenameValue(conversation.title); setRenaming(conversation.id); setMenuId(null); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[#303136]"><Pencil className="h-3 w-3" /> Renomear</button><button onClick={() => void deleteConversation(conversation.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-red-300 hover:bg-[#303136]"><Trash2 className="h-3 w-3" /> Excluir</button></div>}
                </div>
              )) : <div className="p-5 text-center text-xs leading-relaxed text-[#858184]"><MessageSquare className="mx-auto mb-3 h-6 w-6 text-[#e87932]" />Comece uma conversa para transformar os dados em uma decisão.</div>}
          </div>
        </aside>
        <main className={`${!mobileListOpen ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col md:flex`}>
           <header className="flex shrink-0 items-center justify-between border-b border-[#2a2d33] px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMobileListOpen(true)} aria-label="Ver conversas" className="rounded-lg p-1 text-[#aaa4a3] hover:bg-[#25262a] md:hidden"><ChevronLeft className="h-5 w-5" /></button>
               <InPilotMark />
                <div className="min-w-0"><p className="truncate text-sm font-bold text-[#f3eee9]">{activeConversation?.title || "InPilot"}</p><p className="text-[10px] uppercase tracking-[.14em] text-[#8d8988]">Seu analista de contas · fatos antes de opinião</p></div>
            </div>
          </header>
          {error && <div role="alert" className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200 sm:mx-6"><span>{error}</span><button onClick={() => activeId ? void loadMessages(activeId) : void loadConversations()} className="flex shrink-0 items-center gap-1 font-semibold text-red-100"><RefreshCw className="h-3 w-3" /> Tentar novamente</button></div>}
           <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [scrollbar-gutter:stable] sm:px-6 lg:px-8">
              {!activeId ? <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center"><InPilotMark size="lg" /><p className="mt-5 text-[10px] font-bold uppercase tracking-[.2em] text-[#e87932]">InPilot</p><h3 className="mt-2 text-xl font-bold text-[#f3eee9]">Por onde começamos?</h3><p className="mt-2 max-w-md text-sm text-[#999395]">Pergunte sobre mídia, vendas, CRM ou sobre o desempenho geral da conta. A conversa será criada automaticamente no primeiro envio.</p></div> :
               <div className="mx-auto w-full max-w-5xl space-y-4">
                {hasMore && <button disabled={messagesLoading} onClick={() => activeId && void loadMessages(activeId, cursor)} className="mx-auto flex items-center gap-2 rounded-full border border-[#34353b] px-3 py-1.5 text-xs text-[#aaa4a3] hover:border-[#e87932] hover:text-[#e87932]"><ArrowDown className="h-3.5 w-3.5" /> {messagesLoading ? "Carregando…" : "Carregar mensagens anteriores"}</button>}
                {messagesLoading && !messages.length ? <div className="space-y-4"><div className="ml-auto h-16 w-2/3 animate-pulse rounded-2xl bg-[#202126]" /><div className="h-32 w-4/5 animate-pulse rounded-2xl bg-[#202126]" /></div> :
                   messages.length ? messages.map((message, index) => <MessageBubble key={message.id} message={message} question={message.contextQuestion || messages.slice(0, index).reverse().find((item) => item.role === "USER")?.content} onRetry={(text, retry) => void ask(text, retry)} />) :
                       <div className="rounded-2xl border border-dashed border-[#3a3b40] p-8 text-center"><InPilotMark size="sm" /><p className="mt-3 text-sm font-semibold text-[#ded8d4]">Por onde começamos?</p><p className="mt-1 text-xs text-[#858184]">Pergunte o que mudou, qual campanha merece atenção ou onde estão as oportunidades. Eu separo fato de interpretação.</p></div>}
              </div>}
          </div>
           <div className="shrink-0 border-t border-[#2a2d33] bg-[#151619] px-4 py-3 sm:px-6 lg:px-8">
             <div className="mx-auto w-full max-w-5xl">
              <form onSubmit={(event) => { event.preventDefault(); void ask(question); }} className="relative flex items-end rounded-2xl border border-[#3b3635] bg-[#0f1012] p-2 focus-within:border-[#e87932]">
                 <textarea ref={composerRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(question); } }} disabled={sending} maxLength={500} rows={1} placeholder="Pergunte o que você quer entender sobre a conta…" className="max-h-28 min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed" />
                 <button aria-label="Enviar pergunta" disabled={!question.trim() || loading || sending || !filter.dataInicio || !filter.dataFim} className="rounded-xl bg-[#e87932] p-2.5 text-[#1b110c] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
              </form>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}

function AnalystContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  const inline = (value: string) => value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index} className="font-bold text-[#f3eee9]">{part.slice(2, -2)}</strong>
      : <React.Fragment key={index}>{part}</React.Fragment>);
  const isTableDivider = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

  for (let index = 0; index < lines.length;) {
    const raw = lines[index];
    const line = raw.trim();
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const headers = splitMarkdownTableRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitMarkdownTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="my-3 overflow-x-auto rounded-xl border border-[#34353b]">
          <table className="w-full min-w-[480px] border-collapse text-left text-xs leading-5">
            <thead className="bg-[#25262a] text-[#f3eee9]"><tr>{headers.map((header, cellIndex) =>
              <th key={cellIndex} className="border-b border-[#3b3c42] px-3 py-2.5 font-bold">{inline(header)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) =>
              <tr key={rowIndex} className="border-b border-[#292a2f] last:border-0 odd:bg-[#191a1e]">
                {headers.map((_, cellIndex) => <td key={cellIndex} className={`px-3 py-2 align-top ${cellIndex === 0 ? "font-semibold text-[#ded8d4]" : "tabular-nums text-[#bbb5b1]"}`}>{inline(row[cellIndex] ?? "—")}</td>)}
              </tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (!line) {
      index += 1;
      continue;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push(<h4 key={index} className="pb-1 pt-3 text-xs font-black uppercase tracking-[.13em] text-[#e87932]">{inline(headingMatch[2].replace(/:$/, ""))}</h4>);
    } else if (/^[-•]\s+/.test(line)) {
      blocks.push(<div key={index} className="flex gap-2"><span className="mt-[1px] text-[#e87932]">•</span><span>{inline(line.replace(/^[-•]\s+/, ""))}</span></div>);
    } else if (/^\d+[.)]\s+/.test(line)) {
      const marker = line.match(/^\d+/)?.[0];
      blocks.push(<div key={index} className="flex gap-2"><span className="min-w-5 font-bold text-[#e87932]">{marker}.</span><span>{inline(line.replace(/^\d+[.)]\s+/, ""))}</span></div>);
    } else {
      blocks.push(<p key={index}>{inline(line)}</p>);
    }
    index += 1;
  }
  return <div className="space-y-2 text-sm leading-7">{blocks}</div>;
}

type ThinkingTopic = {
  label: string;
  focus: string;
};

function thinkingTopic(question: string): ThinkingTopic {
  const normalized = question.toLocaleLowerCase("pt-BR");
  if (/(campanha|campanhas|mídia|media|anúncio|anuncios|ads|criativo)/.test(normalized)) {
    return { label: "campanhas e anúncios", focus: "desempenho da mídia" };
  }
  if (/(venda|vendas|receita|faturamento|booking|reserva|ocupação|ocupacao)/.test(normalized)) {
    return { label: "vendas e receita", focus: "resultado comercial" };
  }
  if (/(crm|lead|funil|pipeline|contato|contatos|negociação|negociacao)/.test(normalized)) {
    return { label: "CRM e oportunidades", focus: "avanço das oportunidades" };
  }
  if (/(tráfego|trafego|visita|sessão|sessao|site|origem|canal)/.test(normalized)) {
    return { label: "tráfego e canais", focus: "jornada até o site" };
  }
  return { label: "os dados disponíveis", focus: "resultado geral" };
}

function progressVariation(seed: string, stage: number, options: string[]) {
  let hash = stage + 17;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return options[hash % options.length];
}

function ProcessingThought({ question, seed }: { question?: string; seed: string }) {
  const topic = thinkingTopic(question || "");
  const steps = [
    progressVariation(seed, 0, [
      "Entendendo sua pergunta e definindo o foco",
      "Organizando sua pergunta para começar pelo que importa",
      "Identificando o ponto principal da sua análise",
      "Traduzindo sua pergunta em uma análise objetiva",
    ]),
    progressVariation(seed, 1, [
      `Localizando os dados mais úteis sobre ${topic.label}`,
      `Buscando as informações certas sobre ${topic.label}`,
      `Reunindo os dados que ajudam a explicar ${topic.label}`,
      `Selecionando os indicadores mais relevantes de ${topic.label}`,
    ]),
    progressVariation(seed, 2, [
      `Cruzando os números para entender o ${topic.focus}`,
      `Comparando os resultados e procurando padrões`,
      `Conectando os dados para revelar o que mudou`,
      `Analisando tendências, diferenças e pontos de atenção`,
    ]),
    progressVariation(seed, 3, [
      "Separando os sinais importantes do ruído",
      "Conferindo os dados antes de chegar à conclusão",
      "Validando os principais achados da análise",
      "Revisando os números para evitar conclusões apressadas",
    ]),
    progressVariation(seed, 4, [
      "Transformando os dados em uma resposta clara",
      "Organizando os achados para facilitar sua decisão",
      "Preparando uma leitura direta, com contexto e conclusão",
      "Finalizando a análise com os pontos que mais importam",
    ]),
  ];
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => Math.min(current + 1, steps.length - 1)), 2200);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="mt-1 rounded-xl border border-[#44362f] bg-[#211b18] px-3.5 py-3" aria-live="polite" aria-label="O InPilot está preparando a análise">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <span className="absolute h-5 w-5 animate-ping rounded-full bg-[#e87932]/20" />
          <span className="relative h-2 w-2 rounded-full bg-[#e87932]" />
        </span>
        <span key={step} className="animate-[fade-in_.35s_ease-out] text-xs font-medium text-[#e5c5ae]">{steps[step]}</span>
      </div>
      <div className="mt-3 flex gap-1 pl-7" aria-hidden="true">
        {steps.map((_, index) => <span key={index} className={`h-1 rounded-full transition-all duration-500 ${index <= step ? "w-5 bg-[#e87932]" : "w-2 bg-[#5b4032]"}`} />)}
      </div>
    </div>
  );
}

function MessageBubble({ message, question, onRetry }: { message: Message; question?: string; onRetry: (question: string, retry: Pick<Message, "retryIntentToken" | "retryStart" | "retryEnd">) => void }) {
  const user = message.role === "USER";
  return <article className={`flex ${user ? "justify-end" : "justify-start"}`}>
    <div className={`${user ? "max-w-[82%] rounded-2xl rounded-br-md bg-[#2a1d17] text-[#f2e5dd]" : "w-full max-w-[92%] rounded-2xl rounded-bl-md border border-[#302f32] bg-[#191a1e] text-[#e7e0dc]"} px-4 py-3.5 sm:px-5`}>
      <div className="mb-2 flex items-center justify-between gap-4 text-[10px] uppercase tracking-[.13em] text-[#837d7c]"><span className={user ? "" : "inline-flex items-center gap-1.5 text-[#d8986c]"}>{user ? "Você" : <><span className="h-1.5 w-1.5 rounded-full bg-[#e87932]" /> InPilot</>}</span><span>{formatTime(message.createdAt)}</span></div>
       {user ? <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div> : message.status === "PROCESSING" ? <ProcessingThought question={question} seed={message.id} /> : <AnalystContent content={message.content} />}
      {message.status === "ERROR" && <div className="mt-3 flex items-center justify-between gap-3 text-xs text-red-300"><span className="flex items-center gap-2"><X className="h-3.5 w-3.5" /> Não foi possível concluir esta análise.</span>{message.retryQuestion ? <button onClick={() => onRetry(message.retryQuestion!, { retryIntentToken: message.retryIntentToken, retryStart: message.retryStart, retryEnd: message.retryEnd })} className="flex items-center gap-1 rounded-lg border border-red-800/60 px-2 py-1 font-semibold hover:bg-red-950/40"><RefreshCw className="h-3 w-3" /> Tentar novamente</button> : null}</div>}
       {!user && message.status === "COMPLETE" && message.sources?.length ? <div className="mt-4 border-t border-[#303034] pt-3"><div className="flex flex-wrap gap-2">{message.sources.map((source, index) => <span key={`${source.tool}-${index}`} title={source.limitations || undefined} className="inline-flex items-center gap-1.5 rounded-md border border-[#44362f] bg-[#211b18] px-2 py-1 text-[10px] text-[#c7a991]"><Database className="h-3 w-3 text-[#e87932]" />{source.label} · {formatDate(source.period.start)}—{formatDate(source.period.end)}</span>)}</div></div> : null}
    </div>
  </article>;
}