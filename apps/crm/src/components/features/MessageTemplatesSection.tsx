"use client";

import { useState, useEffect, useCallback } from "react";
import { listMessageTemplates, createMessageTemplate, deleteMessageTemplate } from "@/server/actions/messageTemplate";
import { Button, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Trash2 } from "lucide-react";

export function MessageTemplatesSection({ tenantId }: { tenantId: string }) {
  const [list, setList] = useState<Awaited<ReturnType<typeof listMessageTemplates>>>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listMessageTemplates(tenantId).then(setList).catch(() => setError("Erro")).finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await createMessageTemplate(tenantId, { name: name.trim(), content: content.trim() });
      setName("");
      setContent("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      await deleteMessageTemplate(id, tenantId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  if (loading) return <p className="text-neutral-500">Carregando…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates de mensagens (WhatsApp)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Crie modelos para agilizar o atendimento. Eles aparecem no Atendimento ao enviar mensagens.
        </p>
        <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do modelo"
            className="w-40 rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Conteúdo da mensagem"
            className="min-w-[200px] flex-1 rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <Button type="submit" size="sm" isLoading={saving}>Adicionar</Button>
        </form>
        {error && <p className="text-sm text-error-600">{error}</p>}
        <ul className="space-y-2">
          {list.length === 0 && <li className="text-sm text-neutral-500">Nenhum modelo.</li>}
          {list.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-sm border border-neutral-200 bg-neutral-50/50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800/50">
              <div>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{t.name}</span>
                <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{t.content}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onDelete(t.id)} aria-label="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
