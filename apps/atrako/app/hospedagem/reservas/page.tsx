"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button, TextField } from "@/components/ui";
import { formatBrDate } from "@/lib/stay/nights";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  EXPIRED: "Expirada",
};

type Reservation = {
  id: string;
  number: number;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountCents: number;
  status: string;
  channel: string;
};

export default function StayReservationsPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("1");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["stay-reservations", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/stay/reservations?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar reservas");
      return res.json() as Promise<{ reservations: Reservation[] }>;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["stay-reservations", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["stay-summary", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["stay-calendar", workspaceId] });
  };

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/atrako/stay/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error("Não foi possível cancelar");
    },
    onSuccess: refresh,
  });

  const manual = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/atrako/stay/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, guestName, guestPhone, guestEmail, checkIn, checkOut, guests: Number(guests) || 1 }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Não foi possível lançar a reserva");
    },
    onSuccess: () => {
      setGuestName("");
      setGuestPhone("");
      setGuestEmail("");
      setCheckIn("");
      setCheckOut("");
      setError("");
      refresh();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível lançar a reserva"),
  });

  return (
    <section>
      <h1 className="type-tagline">Reservas</h1>
      <p className="type-body mt-2 text-[var(--ink-muted-80)]">A reserva manual já entra como paga e fecha o lead.</p>
      {isLoading ? <p className="type-body mt-6">Carregando…</p> : null}
      <ul className="mt-6 divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]">
        {(data?.reservations ?? []).length === 0 && !isLoading ? (
          <li className="type-body p-5 text-[var(--ink-muted-80)]">Ainda não há reservas.</li>
        ) : null}
        {(data?.reservations ?? []).map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="type-body-strong">#{row.number} · {row.guestName}</p>
              <p className="type-caption mt-1 text-[var(--ink-muted-80)]">
                {formatBrDate(row.checkIn)} – {formatBrDate(row.checkOut)} · {row.nights} noites · {row.guestPhone}
              </p>
              <p className="type-caption mt-1">{STATUS[row.status] ?? row.status} · {brl(row.amountCents)}</p>
            </div>
            {row.status === "CONFIRMED" || row.status === "PENDING_PAYMENT" ? (
              <Button variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(row.id)}>
                Cancelar
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <form
        className="mt-8 grid gap-4 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          manual.mutate();
        }}
      >
        <h2 className="type-body-strong sm:col-span-2">Lançar reserva já paga</h2>
        <TextField label="Nome" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
        <TextField label="Celular" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} required />
        <TextField label="E-mail" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
        <TextField label="Hóspedes" type="number" min={1} max={16} value={guests} onChange={(e) => setGuests(e.target.value)} />
        <TextField label="Check-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        <TextField label="Check-out" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
        {error ? <p className="type-caption text-[var(--ink)] sm:col-span-2">{error}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={manual.isPending}>Salvar reserva</Button>
        </div>
      </form>
    </section>
  );
}
