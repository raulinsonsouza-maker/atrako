"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button, PillSelect, SegmentedControl } from "@/components/ui";
import { api, dateBR, daysUntil, num } from "@/components/relacionamento/format";
import { CalendarSettings } from "@/components/relacionamento/CalendarSettings";
import { ChannelIcon, RelEmpty, RelLoading, RelSection } from "@/components/relacionamento/ui";

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  status: string;
  statusLabel: string;
  eventDate: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  calendarKey: string | null;
  ownerName: string | null;
  approverName: string | null;
  recipientsCount: number | null;
  couponCode: string | null;
};
type Upcoming = { key: string; label: string; date: string; leadDays: number; hint: string | null; custom: boolean; campaignId: string | null };

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "E-mail", WHATSAPP: "WhatsApp", BOTH: "E-mail + WhatsApp" };
const OPEN_STATUSES = ["IDEIA", "BRIEFING", "CRIACAO", "REVISAO", "APROVADA", "AGENDADA", "ENVIANDO"];

export function statusTone(status: string): "ok" | "warn" | "bad" | undefined {
  if (status === "ENVIADA" || status === "APROVADA" || status === "AGENDADA") return "ok";
  if (status === "PERDIDA") return "bad";
  if (status === "REVISAO" || status === "ENVIANDO") return "warn";
  return undefined;
}

export function CampaignsTab({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [creating, setCreating] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("EMAIL");
  const [eventDate, setEventDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const key = ["rel-campaigns", workspaceId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<{ campaigns: CampaignRow[]; upcoming: Upcoming[] }>(`/api/atrako/relacionamento/campaigns?workspaceId=${workspaceId}`),
  });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ id: string }>("/api/atrako/relacionamento/campaigns", { body: { workspaceId, ...body } }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: key });
      router.push(`/relacionamento/campanhas/${r.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isLoading || !data) return <RelLoading />;

  const rows = data.campaigns.filter((c) =>
    filter === "all" ? true : filter === "open" ? OPEN_STATUSES.includes(c.status) : !OPEN_STATUSES.includes(c.status),
  );

  return (
    <div className="flex flex-col gap-4">
      <RelSection
        title="Datas"
        info="Para cada data ligada, a campanha nasce sozinha com a antecedência escolhida e a equipe é avisada até a aprovação. Clique numa data para abrir ou criar a campanha."
        action={
          <button type="button" className="type-fine-print text-[var(--primary)]" onClick={() => setDatesOpen(true)}>
            Configurar datas
          </button>
        }
      >
        {data.upcoming.length ? (
          <div className="rel-strip">
            {data.upcoming.map((d) => {
              const left = daysUntil(d.date);
              return (
                <button
                  key={d.key}
                  type="button"
                  className="rel-date-chip active:scale-95"
                  data-soon={!d.campaignId && left <= d.leadDays}
                  disabled={create.isPending}
                  title={d.hint ?? undefined}
                  onClick={() =>
                    d.campaignId
                      ? router.push(`/relacionamento/campanhas/${d.campaignId}`)
                      : create.mutate({ name: d.label, eventDate: d.date, calendarKey: d.key, channel: "EMAIL" })
                  }
                >
                  <span className="type-caption-strong text-[var(--ink)]">{d.label}</span>
                  <span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">
                    {dateBR(d.date)} · {left <= 0 ? "hoje" : `${left} dias`}
                  </span>
                  <span className="type-micro-legal text-[var(--primary)]">{d.campaignId ? "Abrir" : "Criar campanha"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <RelEmpty
            text="Nenhuma data ligada."
            action={
              <Button variant="outline" className="px-4 py-2" onClick={() => setDatesOpen(true)}>
                Escolher datas
              </Button>
            }
          />
        )}
      </RelSection>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          aria-label="Filtrar campanhas"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Em andamento" },
            { value: "done", label: "Encerradas" },
            { value: "all", label: "Todas" },
          ]}
        />
        <Button size="toolbar" onClick={() => setCreating((v) => !v)}>
          Nova campanha
        </Button>
      </div>

      {creating ? (
        <section className="rel-card grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label>
            <span className="rel-label type-fine-print">Nome</span>
            <input className="rel-input type-caption" value={name} placeholder="ex.: Lançamento coleção verão" onChange={(e) => setName(e.target.value)} />
          </label>
          <div>
            <span className="rel-label type-fine-print">Canal</span>
            <PillSelect
              size="field"
              value={channel}
              onChange={setChannel}
              options={Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label }))}
              aria-label="Canal"
            />
          </div>
          <label>
            <span className="rel-label type-fine-print">Data (opcional)</span>
            <input className="rel-input type-caption" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </label>
          <Button
            className="px-4 py-2"
            disabled={create.isPending || !name.trim()}
            onClick={() => create.mutate({ name, channel, eventDate: eventDate ? `${eventDate}T12:00:00` : undefined })}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar
          </Button>
          {error ? <p className="type-caption text-[var(--ink)] sm:col-span-4">{error}</p> : null}
        </section>
      ) : null}

      <section className="rel-card">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="rel-table type-caption">
              <thead>
                <tr>
                  <th>Campanha</th>
                  <th>Etapa</th>
                  <th>Data</th>
                  <th>Responsável</th>
                  <th>Destinatários</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} data-clickable="true" onClick={() => router.push(`/relacionamento/campanhas/${c.id}`)}>
                    <td className="text-[var(--ink)]">
                      <span className="flex items-center gap-1.5">
                        <ChannelIcon channel={c.channel} />
                        {c.name}
                      </span>
                    </td>
                    <td>
                      <span className="rel-badge type-micro-legal" data-tone={statusTone(c.status)}>
                        {c.statusLabel}
                      </span>
                    </td>
                    <td className="tabular-nums">
                      {dateBR(c.scheduledAt ?? c.eventDate)}
                      {c.eventDate && OPEN_STATUSES.includes(c.status) && daysUntil(c.eventDate) >= 0 ? (
                        <span className="type-micro-legal block text-[var(--ink-muted-48)]">em {daysUntil(c.eventDate)} dias</span>
                      ) : null}
                    </td>
                    <td>{c.ownerName ?? "—"}</td>
                    <td className="tabular-nums">{c.recipientsCount != null ? num(c.recipientsCount) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <RelEmpty text={filter === "open" ? "Nenhuma campanha em andamento." : "Nenhuma campanha aqui."} />
        )}
      </section>

      {datesOpen ? <DatesPanel workspaceId={workspaceId} onClose={() => setDatesOpen(false)} /> : null}
    </div>
  );
}

function DatesPanel({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="panel-modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="panel-modal" style={{ width: "min(560px, 100%)" }} role="dialog" aria-modal="true" aria-label="Datas do calendário">
        <div className="panel-modal-header">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="type-tagline text-[var(--ink)]">Datas do calendário</h2>
              <p className="type-fine-print mt-1 text-[var(--ink-muted-48)]">Ligue as datas e escolha a antecedência da campanha.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-[var(--ink-muted-48)] active:scale-95"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="panel-modal-body">
          <div className="panel-modal-section">
            <CalendarSettings workspaceId={workspaceId} />
          </div>
        </div>
      </aside>
    </div>
  );
}
