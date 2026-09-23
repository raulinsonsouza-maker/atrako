"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { listOverdueTasks } from "@/server/actions/task";
import { Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { AlertCircle } from "lucide-react";

export function OverdueTasksCard({ tenantId }: { tenantId: string }) {
  const [tasks, setTasks] = useState<Awaited<ReturnType<typeof listOverdueTasks>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listOverdueTasks(tenantId, 10).then(setTasks).finally(() => setLoading(false));
  }, [tenantId]);

  if (loading || tasks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-warning-600 dark:text-warning-500">
          <AlertCircle className="h-4 w-4" />
          Tarefas em atraso
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/leads/${t.lead.id}`}
                className="text-sm text-neutral-700 hover:underline dark:text-neutral-300"
              >
                {t.title} — {t.lead.name}
                <span className="ml-1 text-xs text-neutral-500">
                  ({t.dueAt ? new Date(t.dueAt).toLocaleDateString("pt-BR") : ""})
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
