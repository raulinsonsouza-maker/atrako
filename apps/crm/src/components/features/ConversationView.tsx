"use client";

import { useState, useEffect } from "react";
import {
  listConversations,
  listMessages,
  getConversation,
  sendWhatsAppMessage,
} from "@/server/actions/conversation";
import { listMessageTemplates } from "@/server/actions/messageTemplate";
import { Button } from "@/design/components";
import { Send } from "lucide-react";

export function ConversationView({ tenantId }: { tenantId: string }) {
  const [convs, setConvs] = useState<Awaited<ReturnType<typeof listConversations>>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof listMessages>>>([]);
  const [conv, setConv] = useState<Awaited<ReturnType<typeof getConversation>>>(null);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof listMessageTemplates>>>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    listConversations(tenantId).then(setConvs);
  }, [tenantId]);

  useEffect(() => {
    listMessageTemplates(tenantId).then(setTemplates);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const t = setInterval(() => listConversations(tenantId).then(setConvs), 15000);
    return () => clearInterval(t);
  }, [tenantId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setConv(null);
      return;
    }
    getConversation(selectedId, tenantId).then(setConv);
    listMessages(selectedId, tenantId).then(setMessages);
  }, [selectedId, tenantId]);

  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => listMessages(selectedId, tenantId).then(setMessages), 10000);
    return () => clearInterval(t);
  }, [selectedId, tenantId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !text.trim() || sending) return;
    setSending(true);
    try {
      await sendWhatsAppMessage(tenantId, selectedId, text.trim());
      setText("");
      listMessages(selectedId, tenantId).then(setMessages);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-sm border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-3 py-2">
          <h3 className="font-semibold text-neutral-900">Conversas</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 && <p className="p-4 text-sm text-neutral-500">Nenhuma conversa.</p>}
          {convs.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`w-full border-b border-neutral-100 px-3 py-3 text-left ${
                selectedId === c.id ? "bg-primary-50" : "hover:bg-neutral-50"
              }`}
            >
              <p className="truncate font-medium text-neutral-900">{c.lead.name}</p>
              <p className="truncate text-xs text-neutral-500">
                {c.messages[0]?.content?.slice(0, 50) || "—"}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-sm border border-neutral-200 bg-white">
        {!conv ? (
          <div className="flex flex-1 items-center justify-center text-neutral-500">
            Selecione uma conversa
          </div>
        ) : (
          <>
            <div className="border-b border-neutral-200 px-4 py-2">
              <h3 className="font-semibold text-neutral-900">{conv.lead.name}</h3>
              <p className="text-sm text-neutral-500">{conv.lead.phone}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-sm px-3 py-2 ${
                    m.direction === "OUT"
                      ? "ml-auto bg-primary-100 text-primary-900"
                      : "bg-neutral-100 text-neutral-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                  <p className="mt-1 text-xs opacity-70">
                    {new Date(m.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSend} className="flex flex-col gap-2 border-t border-neutral-200 p-3 dark:border-neutral-700">
              {templates.length > 0 && (
                <div className="flex gap-2">
                  <select
                    className="rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) {
                        const t = templates.find((x) => x.id === id);
                        if (t) setText(t.content);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">Inserir modelo…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Mensagem..."
                  className="flex-1 rounded-sm border border-neutral-300 bg-white px-4 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <Button type="submit" disabled={sending || !text.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
