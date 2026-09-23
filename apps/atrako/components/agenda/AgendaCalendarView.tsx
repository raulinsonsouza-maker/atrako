"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  agendaFetchJson,
  useAgendaWorkspace,
} from "@/components/agenda/AgendaWorkspaceClient";
import { ManualBookingModal } from "@/components/agenda/ManualBookingModal";
import {
  bookingStatusLabel,
  serviceTitle,
  startOfWeek,
  toDateInput,
  type AgendaBooking,
  type AgendaBookingPage,
  type AgendaService,
  WEEKDAY_LABELS,
} from "@/components/agenda/agenda-shared";

export function AgendaCalendarView({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const qc = useQueryClient();
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const weekStart = startOfWeek(weekAnchor);
  const weekEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(e.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
  }, [weekStart]);

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["agenda-services", workspaceId],
    queryFn: async () => {
      const r = await fetch(
        `/api/atrako/agenda?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      if (!r.ok) return [] as AgendaService[];
      const j = await r.json();
      return (j.services ?? []) as AgendaService[];
    },
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["agenda-pages", workspaceId],
    queryFn: async () => {
      try {
        return await agendaFetchJson<AgendaBookingPage[]>("pages", workspaceId);
      } catch {
        return [];
      }
    },
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["agenda-bookings", workspaceId, toDateInput(weekStart)],
    queryFn: async () => {
      try {
        return await agendaFetchJson<AgendaBooking[]>("bookings", workspaceId, {
          search: {
            from: toDateInput(weekStart),
            to: toDateInput(weekEnd),
          },
        });
      } catch {
        const r = await fetch(
          `/api/atrako/agenda?workspaceId=${encodeURIComponent(workspaceId)}`,
        );
        if (!r.ok) return [];
        const j = await r.json();
        return (j.bookings ?? []) as AgendaBooking[];
      }
    },
  });

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaBooking[]>();
    for (const d of days) map.set(toDateInput(d), []);
    for (const b of bookings) {
      const key = toDateInput(new Date(b.startAt));
      if (map.has(key)) map.get(key)!.push(b);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
    }
    return map;
  }, [bookings, days]);

  function shiftWeek(delta: number) {
    const n = new Date(weekAnchor);
    n.setDate(n.getDate() + delta * 7);
    setWeekAnchor(n);
  }

  async function cancelBooking(id: string) {
    setCancellingId(id);
    try {
      await agendaFetchJson("bookings", workspaceId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, id }),
      });
      await qc.invalidateQueries({
        queryKey: ["agenda-bookings", workspaceId],
      });
    } finally {
      setCancellingId(null);
    }
  }

  const label = `${weekStart.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-2 active:scale-95"
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setWeekAnchor(new Date())}
            className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2 type-caption-strong active:scale-95"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-2 active:scale-95"
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <p className="type-body-strong text-[var(--ink)]">{label}</p>
          <Button
            type="button"
            variant="primary"
            className="!px-4 !py-2 type-button-utility"
            onClick={() => setModalOpen(true)}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Manual
          </Button>
        </div>
      </div>

      {isLoading || loadingServices ? (
        <div className="flex items-center gap-2 py-12 type-caption text-[var(--ink-muted-48)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-7">
          {days.map((d) => {
            const key = toDateInput(d);
            const items = byDay.get(key) ?? [];
            const isToday = toDateInput(new Date()) === key;
            return (
              <section
                key={key}
                className={`min-h-[140px] rounded-lg border bg-[var(--canvas)] p-3 ${
                  isToday
                    ? "border-[var(--primary)]"
                    : "border-[var(--hairline)]"
                }`}
              >
                <header className="mb-2 border-b border-[var(--divider-soft)] pb-2">
                  <p className="type-fine-print text-[var(--ink-muted-48)]">
                    {WEEKDAY_LABELS[d.getDay()]}
                  </p>
                  <p className="type-caption-strong text-[var(--ink)]">
                    {d.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </p>
                </header>
                {items.length === 0 ? (
                  <p className="type-fine-print text-[var(--ink-muted-48)]">—</p>
                ) : (
                  <ul className="space-y-2">
                    {items.map((b) => (
                      <li
                        key={b.id}
                        className="rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] px-2 py-1.5"
                      >
                        <p className="type-fine-print tabular-nums text-[var(--ink-muted-80)]">
                          {new Date(b.startAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="type-caption-strong text-[var(--ink)]">
                          {b.customerName}
                        </p>
                        <p className="type-fine-print text-[var(--ink-muted-48)]">
                          {serviceTitle(b.service)} ·{" "}
                          {bookingStatusLabel(b.status)}
                        </p>
                        {b.status !== "CANCELLED" ? (
                          <button
                            type="button"
                            disabled={cancellingId === b.id}
                            onClick={() => cancelBooking(b.id)}
                            className="mt-1 type-fine-print text-[var(--primary)] active:scale-95 disabled:opacity-50"
                          >
                            {cancellingId === b.id ? "…" : "Cancelar"}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <ManualBookingModal
          workspaceId={workspaceId}
          services={services}
          pages={pages}
          defaultDate={toDateInput(weekAnchor)}
          onClose={() => {
            setModalOpen(false);
            qc.invalidateQueries({
              queryKey: ["agenda-bookings", workspaceId],
            });
          }}
        />
      ) : null}
    </div>
  );
}

/** Hook helper when parent already has gate context. */
export function useAgendaCalendarWorkspaceId() {
  return useAgendaWorkspace().workspaceId;
}
