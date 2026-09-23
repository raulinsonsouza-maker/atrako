"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
const CONVERSATION_STATUS: Record<string, string> = {
  OPEN: "Em atendimento",
  HANDED_OFF: "Com atendente",
  CLOSED: "Encerrada",
};

function conversationStatusLabel(status: string) {
  return CONVERSATION_STATUS[status] ?? status;
}

type Conversation = {
  id: string;
  phone: string;
  contactName: string | null;
  status: string;
  lastMessageAt: string | null;
  windowExpiresAt: string | null;
  messages: Array<{
    id: string;
    direction: string;
    body: string | null;
    type: string;
    createdAt: string;
    status: string | null;
  }>;
};
export default function WhatsAppInboxPage() {
  const qc = useQueryClient();
  const { data: clientes = [] } = useQuery({
    queryKey: ["wa-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });
  const workspaceId = clientes[0]?.id as string | undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["wa-inbox", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/whatsapp?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        connected: boolean;
        conversations: Conversation[];
      }>;
    },
    enabled: Boolean(workspaceId),
    refetchInterval: 8000,
  });
  const { data: thread } = useQuery({
    queryKey: ["wa-thread", workspaceId, selectedId],
    queryFn: async () => {
      const r = await fetch(
        `/api/atrako/whatsapp?workspaceId=${workspaceId}&conversationId=${selectedId}`,
      );
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ conversation: Conversation }>;
    },
    enabled: Boolean(workspaceId && selectedId),
    refetchInterval: 5000,
  });
  const selected = thread?.conversation ?? data?.conversations?.find((c) => c.id === selectedId);
  const windowOpen = useMemo(() => {
    if (!selected?.windowExpiresAt) return false;
    return new Date(selected.windowExpiresAt).getTime() > Date.now();
  }, [selected?.windowExpiresAt]);
  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !selected || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "send",
          to: selected.phone,
          body: reply.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível enviar a mensagem.");
      setReply("");
      qc.invalidateQueries({ queryKey: ["wa-thread", workspaceId, selectedId] });
      qc.invalidateQueries({ queryKey: ["wa-inbox", workspaceId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  }
  async function startChat(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !newPhone.trim() || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "send",
          to: newPhone.trim(),
          body: reply.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível iniciar a conversa.");
      setSelectedId(j.conversationId);
      setNewPhone("");
      setReply("");
      qc.invalidateQueries({ queryKey: ["wa-inbox", workspaceId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar. Tente novamente.");
    } finally {
      setSending(false);
    }
  }
  async function handoff() {
    if (!workspaceId || !selectedId) return;
    await fetch("/api/atrako/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, action: "handoff", conversationId: selectedId }),
    });
    qc.invalidateQueries({ queryKey: ["wa-thread", workspaceId, selectedId] });
    qc.invalidateQueries({ queryKey: ["wa-inbox", workspaceId] });
  }
  async function sendCheckoutLink() {
    if (!workspaceId || !selected) return;
    const productId = prompt("ID do produto para enviar o link de checkout:");
    if (!productId?.trim()) return;
    setSending(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const r = await fetch("/api/atrako/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "cta",
          to: selected.phone,
          body: "Seu checkout está pronto. Toque para continuar:",
          buttonText: "Pagar agora",
          url: `${origin}/checkout/${productId.trim()}`,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Não foi possível enviar o link.");
      qc.invalidateQueries({ queryKey: ["wa-thread", workspaceId, selectedId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o link. Tente novamente.");
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="flex h-[calc(100vh)] min-h-0 flex-col bg-[var(--canvas-parchment)]">
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4 md:px-6">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="type-tagline text-[var(--ink)]">Atendimento</h1>
        <span className="type-fine-print text-[var(--ink-muted-48)]">
          {data?.connected ? "Conectado" : (
            <Link href="/config/conexoes" className="text-[var(--primary)] hover:underline">
              Conectar
            </Link>
          )}
        </span>
      </header>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[260px_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--hairline)] bg-white">
          <form onSubmit={startChat} className="space-y-2 border-b border-[var(--hairline)] p-3">
            <input
              className="w-full rounded-lg border border-[var(--hairline)] px-2 py-1.5 type-caption"
              placeholder="Telefone com DDI e DDD"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <p className="type-micro-legal text-[var(--ink-muted-48)]">Digite a mensagem ao lado e envie para iniciar.</p>
          </form>
          <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-[var(--hairline)]">
            {(data?.conversations ?? []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full px-3 py-3 text-left type-caption hover:bg-[var(--surface-pearl)] ${
                    selectedId === c.id ? "bg-[var(--canvas-parchment)]" : ""
                  }`}
                >
                  <p className="type-caption-strong text-[var(--ink)]">{c.contactName || c.phone}</p>
                  <p className="truncate type-fine-print text-[var(--ink-muted-48)]">
                    {conversationStatusLabel(c.status)}
                    {c.messages[0]?.body ? ` · ${c.messages[0].body}` : ""}
                  </p>
                </button>
              </li>
            ))}
            {!data?.conversations?.length ? (
              <li className="px-3 py-6 type-caption text-[var(--ink-muted-48)]">
                Nenhuma conversa ainda. Adicione um telefone acima para começar.
              </li>
            ) : null}
          </ul>
        </aside>
        <section className="flex min-h-0 flex-col rounded-xl border border-[var(--hairline)] bg-white">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-[var(--hairline)] px-4 py-3">
                <div>
                  <p className="type-caption-strong text-[var(--ink)]">{selected.contactName || selected.phone}</p>
                  <p className="type-fine-print text-[var(--ink-muted-48)]">
                    {conversationStatusLabel(selected.status)}
                    {windowOpen ? " · prazo de resposta ativo" : " · fora do prazo de resposta"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={sendCheckoutLink}
                    className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print"
                  >
                    Link de checkout
                  </button>
                  {selected.status !== "HANDED_OFF" ? (
                    <button
                      type="button"
                      onClick={handoff}
                      className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 type-fine-print"
                    >
                      Passar para atendente
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                {(selected.messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[80%] rounded-lg px-3 py-2 type-caption ${
                      m.direction === "OUTBOUND"
                        ? "ml-auto bg-[var(--primary)] text-[var(--on-primary)]"
                        : "bg-[var(--canvas-parchment)] text-[var(--ink)]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 type-micro-legal opacity-60">
                      {new Date(m.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={newPhone ? startChat : sendReply} className="border-t border-[var(--hairline)] p-3">
                {error ? <p className="mb-2 type-caption text-red-600">{error}</p> : null}
                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-[var(--hairline)] px-3 py-2 type-caption"
                    placeholder={windowOpen ? "Escreva sua resposta…" : "Fora do prazo de resposta — use um modelo aprovado"}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={sending || !reply.trim()}
                    className="inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-caption text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center type-caption text-[var(--ink-muted-48)]">
              <p>Selecione uma conversa na lista ou inicie uma nova pelo telefone à esquerda.</p>
              <form onSubmit={startChat} className="flex w-full max-w-md gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-[var(--hairline)] px-3 py-2 type-caption"
                  placeholder="Mensagem inicial"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!newPhone.trim() || !reply.trim() || sending}
                  className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-caption text-[var(--on-primary)] active:scale-95 disabled:opacity-50"
                >
                  Iniciar
                </button>
              </form>
              {error ? <p className="text-red-600">{error}</p> : null}
            </div>
          )}
        </section>
      </div>
      </div>
    </div>
  );
}
