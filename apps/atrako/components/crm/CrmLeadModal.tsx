"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Phone, MessageCircle, X } from "lucide-react";
import { PillSelect } from "@/components/ui/pill-select";
import { Button } from "@/components/ui/button";

type JourneyItem = {
  at: string;
  type: string;
  title: string;
  detail?: string | null;
  href?: string | null;
};

type LeadDetail = {
  lead: {
    id: string;
    contactId: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    source: string | null;
    dealValue: number | null;
    stageId: string | null;
    stageName: string | null;
    stageColor: string | null;
    sources: string[];
  };
  stages: Array<{ id: string; name: string; color: string }>;
  journey: JourneyItem[];
};

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export function CrmLeadModal({
  workspaceId,
  leadId,
  onClose,
}: {
  workspaceId: string;
  leadId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["crm-lead", workspaceId, leadId],
    queryFn: async () => {
      const r = await fetch(
        `/api/atrako/crm/leads/${leadId}?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<LeadDetail>;
    },
  });

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

  async function moveStage(stageId: string) {
    if (!data?.lead.stageId || stageId === data.lead.stageId) return;
    const r = await fetch("/api/atrako/crm/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, leadId, stageId }),
    });
    if (!r.ok) return;
    await qc.invalidateQueries({ queryKey: ["crm-lead", workspaceId, leadId] });
    await qc.invalidateQueries({ queryKey: ["crm-pipeline", workspaceId] });
  }

  const lead = data?.lead;
  const stageColor = lead?.stageColor || "var(--primary)";

  return (
    <div
      className="panel-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="panel-modal"
        role="dialog"
        aria-modal="true"
        aria-label={lead?.name ?? "Lead"}
        style={{ ["--stage-color" as string]: stageColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-modal-header">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                {[lead?.stageName, lead?.source].filter(Boolean).join(" · ") || "Lead"}
              </p>
              <h2 className="mt-1 type-tagline truncate text-[var(--ink)]">
                {isLoading ? "…" : lead?.name ?? "Lead"}
              </h2>
              {lead?.dealValue != null && lead.dealValue > 0 ? (
                <p className="mt-1 type-body-strong tabular-nums text-[var(--primary)]">
                  {fmtCurrency(lead.dealValue)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)] hover:text-[var(--ink)] active:scale-95"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="panel-modal-body">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
            </div>
          ) : isError || !lead ? (
            <p className="py-10 text-center type-caption text-[var(--ink-muted-48)]">
              Não foi possível carregar
            </p>
          ) : (
            <>
              <div className="panel-modal-section space-y-3">
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="type-micro-legal text-[var(--ink-muted-48)]">E-mail</p>
                    <p className="truncate type-caption text-[var(--ink)]">{lead.email || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted-48)]" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="type-micro-legal text-[var(--ink-muted-48)]">Telefone</p>
                    <p className="truncate type-caption text-[var(--ink)]">{lead.phone || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="panel-modal-section">
                <p className="mb-2 type-caption-strong text-[var(--ink)]">Etapa</p>
                <PillSelect
                  size="field"
                  aria-label="Etapa"
                  value={lead.stageId ?? ""}
                  onChange={moveStage}
                  options={(data?.stages ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                    color: s.color,
                  }))}
                />
              </div>

              {lead.sources.length > 0 ? (
                <div className="panel-modal-section">
                  <p className="mb-2 type-caption-strong text-[var(--ink)]">Origens</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.sources.map((s) => (
                      <span
                        key={s}
                        className="rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] px-2.5 py-0.5 type-micro-legal text-[var(--ink-muted-48)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="panel-modal-section">
                <p className="mb-3 type-caption-strong text-[var(--ink)]">Jornada</p>
                {!data?.journey.length ? (
                  <p className="type-fine-print text-[var(--ink-muted-48)]">Sem eventos ainda</p>
                ) : (
                  <ol className="journey-rail">
                    {data.journey.map((item, idx) => (
                      <li key={`${item.at}-${item.type}-${idx}`} className="journey-rail-item">
                        <span className="journey-rail-dot" />
                        <p className="type-micro-legal text-[var(--ink-muted-48)]">
                          {new Date(item.at).toLocaleString("pt-BR")}
                        </p>
                        <p className="type-caption-strong text-[var(--ink)]">{item.title}</p>
                        {item.detail ? (
                          <p className="type-fine-print text-[var(--ink-muted-48)]">{item.detail}</p>
                        ) : null}
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="type-fine-print text-[var(--primary)] hover:underline"
                          >
                            ver
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>

        <div className="panel-modal-footer">
          {lead?.phone ? (
            <Link
              href="/whatsapp"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-caption-strong text-[var(--on-primary)] active:scale-95"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
              WhatsApp
            </Link>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="!px-4 !py-2 type-button-utility"
          >
            Fechar
          </Button>
        </div>
      </aside>
    </div>
  );
}
