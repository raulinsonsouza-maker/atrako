"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button, TextField } from "@/components/ui";
import { addDays, monthCells } from "@/lib/stay/nights";

const WEEK = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

type Day = {
  date: string;
  state: "free" | "occupied" | "blocked" | "past";
  guestName: string | null;
  blockId: string | null;
  blockReason: string | null;
  number: number | null;
};

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function StayCalendarPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["stay-calendar", workspaceId, month],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/stay/calendar?workspaceId=${workspaceId}&month=${month}`);
      if (!res.ok) throw new Error("Falha ao carregar o calendário");
      return res.json() as Promise<{ month: string; today: string; days: Day[] }>;
    },
  });

  const byDate = useMemo(() => new Map((data?.days ?? []).map((day) => [day.date, day])), [data]);
  const [year, mon] = month.split("-").map(Number);
  const cells = monthCells(year, mon);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["stay-calendar", workspaceId] });

  const block = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/atrako/stay/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, startDate: start, endDate: end, reason }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Não foi possível bloquear");
    },
    onSuccess: () => {
      setStart(null);
      setEnd(null);
      setReason("");
      setError("");
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível bloquear"),
  });

  const unblock = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/atrako/stay/blocks/${id}?workspaceId=${workspaceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Não foi possível abrir essas noites");
    },
    onSuccess: refresh,
  });

  function pick(date: string) {
    const day = byDate.get(date);
    if (!day || day.state === "past") return;
    if (day.state === "blocked" && day.blockId && (!start || end)) {
      unblock.mutate(day.blockId);
      return;
    }
    if (!start || end) {
      if (day.state !== "free") return;
      setStart(date);
      setEnd(null);
      return;
    }
    if (date <= start) {
      if (day.state !== "free") return;
      setStart(date);
      setEnd(null);
      return;
    }
    const conflict = (data?.days ?? []).some((item) => item.date >= start && item.date < date && item.state !== "free" && item.state !== "past");
    if (conflict) {
      setError("Esse intervalo passa por uma noite ocupada.");
      return;
    }
    setEnd(date);
    setError("");
  }

  return (
    <section>
      <h1 className="type-tagline">Calendário</h1>
      <p className="type-body mt-2 text-[var(--ink-muted-80)]">
        Escolha a primeira noite e o dia de saída para bloquear. Um dia bloqueado, ao ser clicado, volta a ficar livre.
      </p>
      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setMonth((value) => shiftMonth(value, -1))}>Mês anterior</Button>
        <p className="type-body-strong capitalize">{monthLabel(month)}</p>
        <Button variant="outline" onClick={() => setMonth((value) => shiftMonth(value, 1))}>Próximo mês</Button>
      </div>
      {isLoading ? <p className="type-body mt-6">Carregando…</p> : null}
      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEK.map((label) => (
          <span key={label} className="type-caption py-2 text-center text-[var(--ink-muted-80)]">{label}</span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`empty-${index}`} />;
          const day = byDate.get(date);
          const inRange = Boolean(start && end && date >= start && date < end);
          const edge = date === start || date === end;
          const tone =
            day?.state === "occupied"
              ? "bg-[var(--surface-black)] text-[var(--on-dark)]"
              : day?.state === "blocked"
                ? "bg-[var(--canvas)] text-[var(--ink-muted-80)] line-through"
                : day?.state === "past"
                  ? "text-[var(--ink-muted-80)]"
                  : inRange || edge
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "bg-[var(--canvas)]";
          return (
            <button
              key={date}
              type="button"
              onClick={() => pick(date)}
              className={`min-h-16 rounded-[var(--radius-xs)] px-1 py-2 text-left ${tone}`}
            >
              <span className="type-caption-strong">{date.slice(8)}</span>
              {day?.guestName ? <span className="type-fine-print mt-1 block truncate">{day.guestName}</span> : null}
              {day?.state === "blocked" ? <span className="type-fine-print mt-1 block">fechado</span> : null}
            </button>
          );
        })}
      </div>
      <form
        className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          if (!start || !end) {
            setError("Escolha a primeira noite e o dia de saída.");
            return;
          }
          block.mutate();
        }}
      >
        <TextField label="Motivo do bloqueio" value={reason} onChange={(e) => setReason(e.target.value)} hint={start ? `${start} até ${end || addDays(start, 1)}` : "Nenhum intervalo escolhido"} />
        <Button type="submit" disabled={block.isPending || !start || !end}>Bloquear noites</Button>
      </form>
      {error ? <p className="type-caption mt-3">{error}</p> : null}
    </section>
  );
}
