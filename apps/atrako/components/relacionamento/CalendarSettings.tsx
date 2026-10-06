"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button, PillSelect, Switch } from "@/components/ui";
import { api, dateBR } from "@/components/relacionamento/format";
import { RelLoading } from "@/components/relacionamento/ui";

type Seasonal = { key: string; label: string; date: string; hint: string | null; enabled: boolean; leadDays: number };
type Custom = { key: string; label: string; date: string | null; recurring: boolean; enabled: boolean; leadDays: number };

const LEAD_OPTIONS = [15, 21, 30, 45, 60].map((n) => ({ value: String(n), label: `${n} dias antes` }));

/** Datas comerciais + datas da loja: liga/desliga e antecedência da campanha automática. */
export function CalendarSettings({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["rel-calendar", workspaceId];
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<{ seasonal: Seasonal[]; custom: Custom[] }>(`/api/atrako/relacionamento/calendar?workspaceId=${workspaceId}`),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/api/atrako/relacionamento/calendar", { body: { workspaceId, ...body } }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["rel-campaigns", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["rel-overview", workspaceId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading || !data) return <RelLoading compact />;

  const rows = [
    ...data.seasonal.map((d) => ({ ...d, sub: d.hint, custom: false })),
    ...data.custom.map((d) => ({ ...d, hint: null, sub: `Data da loja${d.recurring ? " · todo ano" : ""}`, custom: true })),
  ];

  return (
    <div className="space-y-4">
      {error ? <p className="type-caption text-[var(--ink)]">{error}</p> : null}
      <div className="rel-list">
        {rows.map((d) => (
          <div key={d.key} className="rel-list-row">
            <div className="min-w-0 flex-1" style={d.enabled ? undefined : { opacity: 0.55 }}>
              <p className="truncate type-caption-strong text-[var(--ink)]">{d.label}</p>
              <p className="truncate type-fine-print text-[var(--ink-muted-48)]">
                {dateBR(d.date)}
                {d.sub ? ` · ${d.sub}` : ""}
              </p>
            </div>
            <PillSelect
              value={String(d.leadDays)}
              onChange={(v) => save.mutate({ key: d.key, leadDays: Number(v) })}
              options={LEAD_OPTIONS}
              aria-label="Antecedência da campanha"
              disabled={!d.enabled}
            />
            <Switch checked={d.enabled} onChange={(v) => save.mutate({ key: d.key, enabled: v })} aria-label={`${d.label} ligada`} />
            {d.custom ? (
              <button
                type="button"
                aria-label="Excluir"
                className="p-1.5 text-[var(--ink-muted-48)] active:scale-95"
                onClick={() => save.mutate({ action: "delete", key: d.key })}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rel-inset space-y-3">
        <p className="type-caption-strong text-[var(--ink)]">Nova data da loja</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input className="rel-input type-caption" placeholder="ex.: Aniversário da loja" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className="rel-input type-caption" type="date" aria-label="Dia" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 type-caption text-[var(--ink)]">
            <Switch checked={recurring} onChange={setRecurring} aria-label="Repete todo ano" />
            Repete todo ano
          </label>
          <Button
            className="px-4 py-2"
            disabled={save.isPending || !label.trim() || !date}
            onClick={() =>
              save.mutate(
                { label, date, recurring },
                {
                  onSuccess: () => {
                    setLabel("");
                    setDate("");
                  },
                },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}
