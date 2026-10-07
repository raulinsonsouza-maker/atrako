"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { api, dateBR, daysUntil, num } from "@/components/relacionamento/format";
import { ChannelIcon, RelEmpty, RelLoading, RelSection } from "@/components/relacionamento/ui";
import { relHref } from "@/components/relacionamento/nav";
import { STAGE_LABEL, campaignStage, statusTone } from "@/components/relacionamento/campaignStage";

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

const NEXT_STEP: Record<string, string> = {
  planejar: "Próximo passo: planejar",
  criar: "Próximo passo: criar a mensagem",
};

export function CampaignsTab({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [name, setName] = useState("");
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

  const byStage = (stages: string[]) => data.campaigns.filter((c) => stages.includes(campaignStage(c.status)));
  const todo = byStage(["planejar", "criar"]).sort((a, b) => (a.eventDate ?? "9").localeCompare(b.eventDate ?? "9"));
  const scheduled = byStage(["agendar"]).sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const sent = byStage(["enviada"]).sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? "")).slice(0, 12);
  const cancelled = byStage(["cancelada"]);
  const submit = () => name.trim() && create.mutate({ name: name.trim(), channel: "EMAIL" });

  return (
    <div className="flex flex-col gap-4">
      <RelSection
        title="Próximas datas"
        info="Para cada data ligada, a campanha nasce sozinha com a antecedência escolhida. Toque numa data para abrir ou criar a campanha."
        action={
          <Link href={relHref("ajustes", "datas")} className="type-fine-print text-[var(--primary)]">
            Configurar datas
          </Link>
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
              <Link href={relHref("ajustes", "datas")} className="type-caption-strong text-[var(--primary)]">
                Escolher datas
              </Link>
            }
          />
        )}
      </RelSection>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-body-strong text-[var(--ink)]">Campanhas</h2>
        {creating ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              className="rel-input type-caption w-64"
              value={name}
              placeholder="Nome, ex.: Coleção de verão"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setCreating(false);
              }}
            />
            <Button size="toolbar" disabled={create.isPending || !name.trim()} onClick={submit}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar
            </Button>
            <Button variant="ghost" size="toolbar" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button size="toolbar" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nova campanha
          </Button>
        )}
      </div>
      {error ? <p className="rel-card type-caption text-[var(--ink)]">{error}</p> : null}

      {!data.campaigns.length ? (
        <section className="rel-card">
          <RelEmpty text="Nenhuma campanha ainda. Crie uma ou toque numa data acima." />
        </section>
      ) : null}

      {data.campaigns.length ? (
        <CampaignGroup title="Precisa de ação" rows={todo} empty="Tudo em dia." onOpen={(id) => router.push(`/relacionamento/campanhas/${id}`)} />
      ) : null}
      <CampaignGroup title="Agendadas" rows={scheduled} onOpen={(id) => router.push(`/relacionamento/campanhas/${id}`)} />
      <CampaignGroup title="Enviadas" rows={sent} onOpen={(id) => router.push(`/relacionamento/campanhas/${id}`)} />

      {cancelled.length ? (
        <div>
          <button type="button" className="inline-flex items-center gap-1 type-fine-print text-[var(--ink-muted-80)]" onClick={() => setShowCancelled((v) => !v)}>
            {showCancelled ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Canceladas ({cancelled.length})
          </button>
          {showCancelled ? (
            <div className="mt-3">
              <CampaignGroup rows={cancelled} onOpen={(id) => router.push(`/relacionamento/campanhas/${id}`)} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CampaignGroup({ title, rows, empty, onOpen }: { title?: string; rows: CampaignRow[]; empty?: string; onOpen: (id: string) => void }) {
  if (!rows.length && !empty) return null;
  return (
    <section className="flex flex-col gap-2">
      {title ? (
        <h3 className="type-caption-strong text-[var(--ink-muted-80)]">
          {title} {rows.length ? <span className="text-[var(--ink-muted-48)]">· {rows.length}</span> : null}
        </h3>
      ) : null}
      {rows.length ? (
        <div className="rel-campaign-grid">
          {rows.map((c) => (
            <CampaignCard key={c.id} c={c} onOpen={() => onOpen(c.id)} />
          ))}
        </div>
      ) : (
        <p className="type-fine-print text-[var(--ink-muted-48)]">{empty}</p>
      )}
    </section>
  );
}

function CampaignCard({ c, onOpen }: { c: CampaignRow; onOpen: () => void }) {
  const stage = campaignStage(c.status);
  const on = stage === "planejar" ? 1 : stage === "criar" ? 2 : stage === "cancelada" ? 0 : 3;
  const left = c.eventDate ? daysUntil(c.eventDate) : null;
  const when =
    stage === "enviada"
      ? `Enviada ${dateBR(c.sentAt)}`
      : stage === "agendar"
        ? `Sai ${dateBR(c.scheduledAt, true)}`
        : c.eventDate
          ? `${dateBR(c.eventDate)}${left != null && left >= 0 ? ` · em ${left} dias` : ""}`
          : "Sem data";
  return (
    <button type="button" className="rel-campaign-card active:scale-95" onClick={onOpen}>
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="type-body-strong block truncate text-[var(--ink)]">{c.name}</span>
          <span className="flex items-center gap-1.5 type-fine-print text-[var(--ink-muted-48)]">
            <ChannelIcon channel={c.channel} />
            {when}
          </span>
        </span>
        <span className="rel-badge type-micro-legal shrink-0" data-tone={statusTone(c.status)}>
          {STAGE_LABEL[c.status] ?? c.statusLabel}
        </span>
      </span>
      <span className="rel-campaign-steps" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} data-on={n <= on} />
        ))}
      </span>
      <span className="flex items-center justify-between gap-2 type-fine-print text-[var(--ink-muted-48)]">
        <span>{NEXT_STEP[stage] ?? (c.recipientsCount != null ? `${num(c.recipientsCount)} contatos` : "")}</span>
        {c.ownerName ? <span className="truncate">{c.ownerName}</span> : null}
      </span>
    </button>
  );
}
