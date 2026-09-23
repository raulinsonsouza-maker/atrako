"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl, bookingStatusLabel } from "@/components/agenda/agenda-shared";

type PublicBooking = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  timezone: string;
  customerName: string;
  serviceTitle: string;
  professionalName: string | null;
  amountCents: number;
  paymentStatus: string | null;
  workspaceName: string;
};

export default function ManageBookingPage() {
  const params = useParams();
  const token = params.token as string;
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/atrako/agenda/public/manage/${token}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Não encontrado");
        if (!cancelled) setBooking(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function cancel() {
    if (!booking || booking.status === "CANCELLED") return;
    setCancelling(true);
    setError("");
    try {
      const r = await fetch(`/api/atrako/agenda/public/manage/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Falha ao cancelar");
      const refresh = await fetch(`/api/atrako/agenda/public/manage/${token}`);
      const j = await refresh.json();
      if (refresh.ok) setBooking(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setCancelling(false);
    }
  }

  const canCancel =
    booking?.status === "CONFIRMED" || booking?.status === "PENDING_PAYMENT";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="type-body text-[var(--ink-muted-80)]">{error}</p>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="min-h-screen bg-[var(--canvas)] px-5 py-10">
      <div className="mx-auto max-w-md space-y-6">
        <header className="text-center">
          <p className="type-caption text-[var(--ink-muted-48)]">{booking.workspaceName}</p>
          <h1 className="mt-1 type-tagline text-[var(--ink)]">Seu agendamento</h1>
        </header>

        <div className="utility-card space-y-3 !p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="type-body-strong text-[var(--ink)]">{booking.serviceTitle}</span>
            <span className="rounded-sm bg-[var(--canvas-parchment)] px-2 py-0.5 type-fine-print text-[var(--ink-muted-80)]">
              {bookingStatusLabel(booking.status)}
            </span>
          </div>
          <p className="type-body text-[var(--ink-muted-80)]">
            {format(parseISO(booking.startAt), "EEEE, d 'de' MMMM 'às' HH:mm", {
              locale: ptBR,
            })}
          </p>
          {booking.professionalName ? (
            <p className="type-caption text-[var(--ink-muted-48)]">
              Com {booking.professionalName}
            </p>
          ) : null}
          {booking.amountCents > 0 ? (
            <p className="type-caption-strong text-[var(--ink)]">{brl(booking.amountCents)}</p>
          ) : null}
          {booking.paymentStatus ? (
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              Pagamento: {booking.paymentStatus}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="type-caption text-[var(--ink-muted-80)]">{error}</p>
        ) : null}

        {canCancel ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={cancelling}
            onClick={() => cancel()}
          >
            {cancelling ? "Cancelando…" : "Cancelar agendamento"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
