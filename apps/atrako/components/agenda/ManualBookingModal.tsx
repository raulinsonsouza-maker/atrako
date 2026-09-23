"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import type { AgendaBookingPage, AgendaService } from "@/components/agenda/agenda-shared";
import { agendaFetchJson } from "@/components/agenda/AgendaWorkspaceClient";

type Props = {
  workspaceId: string;
  services: AgendaService[];
  pages: AgendaBookingPage[];
  defaultDate?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function ManualBookingModal({
  workspaceId,
  services,
  pages,
  defaultDate,
  onClose,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [bookingPageId, setBookingPageId] = useState(
    pages.find((p) => p.isDefault)?.id ?? pages[0]?.id ?? "",
  );
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!serviceId || !customerName.trim()) {
      setError("Preencha serviço e nome do cliente.");
      return;
    }
    const startAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startAt.getTime())) {
      setError("Data ou horário inválido.");
      return;
    }
    setSaving(true);
    try {
      await agendaFetchJson("bookings/manual", workspaceId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          ...(bookingPageId ? { bookingPageId } : {}),
          serviceId,
          startAt: startAt.toISOString(),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
        }),
      });
      await qc.invalidateQueries({ queryKey: ["agenda-bookings", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["agenda-data", workspaceId] });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2.5 type-body text-[var(--ink)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)]";

  return (
    <div
      className="panel-modal-backdrop"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div className="panel-modal" role="dialog" aria-labelledby="manual-booking-title">
        <div className="panel-modal-header">
          <h2 id="manual-booking-title" className="type-body-strong text-[var(--ink)]">
            Agendamento manual
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-xs)] p-1 text-[var(--ink-muted-48)] active:scale-95"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="panel-modal-body space-y-4">
            {pages.length > 1 ? (
              <div className="space-y-1.5">
                <label className="type-fine-print text-[var(--ink-muted-48)]">Página</label>
                <PillSelect
                  size="field"
                  value={bookingPageId}
                  onChange={setBookingPageId}
                  options={pages.map((p) => ({ value: p.id, label: p.title }))}
                  aria-label="Página de agendamento"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="type-fine-print text-[var(--ink-muted-48)]">Serviço</label>
              <PillSelect
                size="field"
                value={serviceId}
                onChange={setServiceId}
                options={services.map((s) => ({
                  value: s.id,
                  label: `${s.title} · ${s.durationMinutes} min`,
                }))}
                aria-label="Serviço"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="type-fine-print text-[var(--ink-muted-48)]">Data</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={date}
                  onChange={(ev) => setDate(ev.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="type-fine-print text-[var(--ink-muted-48)]">Horário</label>
                <input
                  type="time"
                  className={fieldClass}
                  value={time}
                  onChange={(ev) => setTime(ev.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="type-fine-print text-[var(--ink-muted-48)]">Cliente</label>
              <input
                className={fieldClass}
                value={customerName}
                onChange={(ev) => setCustomerName(ev.target.value)}
                placeholder="Nome"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="type-fine-print text-[var(--ink-muted-48)]">Telefone</label>
              <input
                className={fieldClass}
                value={customerPhone}
                onChange={(ev) => setCustomerPhone(ev.target.value)}
                placeholder="Opcional"
                inputMode="tel"
              />
            </div>
            {error ? <p className="type-caption text-[var(--ink)]">{error}</p> : null}
          </div>
          <div className="panel-modal-footer">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !services.length}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
