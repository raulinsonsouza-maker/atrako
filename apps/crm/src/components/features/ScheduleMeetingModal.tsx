"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, Button, Input } from "@/design/components";
import { Calendar, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { scheduleMeeting } from "@/server/actions/activity";

const DURATION_OPTIONS = [
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 45, label: "45 minutos" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1h 30min" },
  { value: 120, label: "2 horas" },
];

export interface ScheduleMeetingModalProps {
  leadId: string;
  leadName: string;
  leadEmail?: string | null;
  open: boolean;
  onClose: () => void;
  isCalendarConnected?: boolean;
}

export function ScheduleMeetingModal({
  leadId,
  leadName,
  leadEmail,
  open,
  onClose,
  isCalendarConnected = false,
}: ScheduleMeetingModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [title, setTitle] = useState(`Reunião com ${leadName}`);
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startAt) {
      setError("Selecione a data e hora da reunião");
      return;
    }

    startTransition(async () => {
      try {
        const result = await scheduleMeeting({
          leadId,
          title: title.trim() || `Reunião com ${leadName}`,
          startAt: new Date(startAt),
          durationMinutes: duration,
          description: description.trim() || undefined,
        });

        if (result.success) {
          setSuccess(true);
          setTimeout(() => {
            onClose();
            setSuccess(false);
            setTitle(`Reunião com ${leadName}`);
            setStartAt("");
            setDuration(30);
            setDescription("");
            router.refresh();
          }, 1500);
        } else {
          setError(result.error || "Erro ao agendar reunião");
        }
      } catch (err) {
        setError("Erro ao agendar reunião. Tente novamente.");
      }
    });
  };

  const handleClose = () => {
    if (!isPending) {
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Agendar Reunião" size="md">
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle className="h-12 w-12 text-success-500 mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
            Reunião agendada!
          </h3>
          {isCalendarConnected && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
              Evento sincronizado com Google Calendar
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Indicador de status do Google Calendar */}
          <div
            className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm ${
              isCalendarConnected
                ? "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400"
                : "bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400"
            }`}
          >
            {isCalendarConnected ? (
              <>
                <Calendar className="h-4 w-4" />
                <span>Google Calendar conectado - evento será sincronizado</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                <span>Google Calendar não conectado - reunião será salva apenas no CRM</span>
              </>
            )}
          </div>

          <Input
            label="Título da reunião"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Reunião com ${leadName}`}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Data e hora de início
            </label>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Duração
            </label>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-neutral-400" />
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="flex-1 rounded-sm border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Descrição / Observações
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Detalhes sobre a reunião..."
            />
          </div>

          {leadEmail && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              O lead ({leadEmail}) será adicionado como convidado no evento.
            </p>
          )}

          {error && (
            <div className="rounded-sm bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-900/20 dark:text-error-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending} className="flex-1">
              Agendar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
