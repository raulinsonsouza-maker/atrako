"use client";

import { useState, useEffect, useCallback } from "react";
import { createTask, listTasksByLead, completeTask } from "@/server/actions/task";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Check, Circle } from "lucide-react";

export function TasksSection({
  leadId,
  tenantId,
  users,
}: {
  leadId: string;
  tenantId: string;
  users: { id: string; name: string }[];
}) {
  const [tasks, setTasks] = useState<Awaited<ReturnType<typeof listTasksByLead>>>([]);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listTasksByLead(leadId, tenantId).then(setTasks).catch(() => setError("Erro ao carregar")).finally(() => setLoading(false));
  }, [leadId, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await createTask(tenantId, {
        leadId,
        type: "manual",
        title: title.trim(),
        dueAt: dueAt ? new Date(dueAt) : undefined,
        assignedToId: assignedToId || null,
      });
      setTitle("");
      setDueAt("");
      setAssignedToId("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setSaving(false);
    }
  }

  async function onComplete(id: string) {
    setError(null);
    try {
      await completeTask(id, tenantId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  if (loading) return <p className="text-neutral-500">Carregando tarefas…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarefas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nova tarefa"
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" isLoading={saving}>Adicionar</Button>
        </form>
        {error && <p className="text-sm text-error-600">{error}</p>}
        <ul className="space-y-2">
          {tasks.length === 0 && <li className="text-sm text-neutral-500">Nenhuma tarefa.</li>}
          {tasks.map((t) => (
            <li
              key={t.id}
              className={`flex items-center gap-2 rounded-sm border px-3 py-2 ${
                t.completedAt ? "border-neutral-100 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50" : "border-neutral-200 dark:border-neutral-700"
              }`}
            >
              <button
                type="button"
                onClick={() => !t.completedAt && onComplete(t.id)}
                className="shrink-0 text-neutral-400 hover:text-primary-600"
                aria-label={t.completedAt ? "Concluída" : "Concluir"}
              >
                {t.completedAt ? <Check className="h-4 w-4 text-primary-600" /> : <Circle className="h-4 w-4" />}
              </button>
              <span className={t.completedAt ? "flex-1 text-sm text-neutral-500 line-through" : "flex-1 text-sm"}>
                {t.title}
                {t.dueAt && (
                  <span className="ml-2 text-xs text-neutral-400">
                    — {new Date(t.dueAt).toLocaleDateString("pt-BR")}
                    {!t.completedAt && new Date(t.dueAt) < new Date() && (
                      <span className="text-warning-600"> (atrasada)</span>
                    )}
                  </span>
                )}
              </span>
              {t.assignedTo && <span className="text-xs text-neutral-400">{t.assignedTo.name}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
