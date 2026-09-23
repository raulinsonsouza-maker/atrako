"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  getConversationByLeadId,
  listMessages,
  sendWhatsAppMessage,
} from "@/server/actions/conversation";
import { listMessageTemplates } from "@/server/actions/messageTemplate";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/design/components";
import { MessageSquare, Send } from "lucide-react";

export function LeadConversationBlock({ leadId, tenantId }: { leadId: string; tenantId: string }) {
  const [conv, setConv] = useState<Awaited<ReturnType<typeof getConversationByLeadId>>>(null);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof listMessages>>>([]);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof listMessageTemplates>>>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getConversationByLeadId(leadId, tenantId).then((c) => {
      setConv(c);
      if (c) listMessages(c.id, tenantId).then(setMessages);
      else setMessages([]);
    });
  }, [leadId, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listMessageTemplates(tenantId).then(setTemplates);
  }, [tenantId]);

  useEffect(() => {
    if (!conv) return;
    const t = setInterval(() => listMessages(conv.id, tenantId).then(setMessages), 10000);
    return () => clearInterval(t);
  }, [conv?.id, tenantId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!conv || !text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendWhatsAppMessage(tenantId, conv.id, text.trim());
      setText("");
      listMessages(conv.id, tenantId).then(setMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!conv ? (
          <div className="rounded-sm border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center dark:border-neutral-700 dark:bg-neutral-800/50">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Nenhuma conversa WhatsApp. O chat aparecerá quando o lead enviar mensagem ou ao iniciar pelo Atendimento.
            </p>
            <Link
              href="/dashboard/atendimento"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Ir para Atendimento
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-sm border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
              {messages.length === 0 && (
                <p className="py-4 text-center text-sm text-neutral-500">Nenhuma mensagem ainda.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-sm px-3 py-2 ${
                    m.direction === "OUT"
                      ? "ml-auto bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-100"
                      : "bg-white text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                  <p className="mt-1 text-xs opacity-70">{new Date(m.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSend} className="mt-3 flex flex-col gap-2">
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              {templates.length > 0 && (
                <select
                  className="w-fit rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
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
              )}
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Mensagem..."
                  className="flex-1 rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                />
                <Button type="submit" size="sm" disabled={sending || !text.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
