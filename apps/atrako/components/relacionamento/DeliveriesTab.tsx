"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button, OptionChip, PillSelect, SearchInput } from "@/components/ui";
import { DELIVERY_STATUS_LABEL, api, brl, brlMicros, dateBR, deliveryTone, num } from "@/components/relacionamento/format";
import type { RelPeriod } from "@/components/relacionamento/period";
import { ChannelIcon, RelEmpty, RelLoading, RelSection } from "@/components/relacionamento/ui";

type Row = {
  id: string;
  channel: "EMAIL" | "WHATSAPP";
  status: string;
  toAddress: string | null;
  subject: string | null;
  templateName: string | null;
  origin: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  convertedAt: string | null;
  convertedCents: number | null;
  conversionKind: string | null;
  error: string | null;
  isTest: boolean;
  createdAt: string;
  contact: { id: string; name: string | null } | null;
};
type ListData = { rows: Row[]; total: number; page: number; pageSize: number; flows: Array<{ id: string; name: string }>; campaigns: Array<{ id: string; name: string }> };
type Detail = {
  delivery: Row & {
    events: Array<{ id: string; type: string; at: string; meta: Record<string, unknown> | null }>;
    deliveredAt: string | null;
    bouncedAt: string | null;
    complainedAt: string | null;
    failedAt: string | null;
    costMicros: number | null;
    couponCode: string | null;
    destination: string | null;
    flowName: string | null;
    campaignName: string | null;
    leadId: string | null;
    contact: { id: string; name: string | null; email: string | null; phone: string | null } | null;
  };
  preview: { channel: string; html?: string; text?: string } | null;
};
type Suppressed = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  emailOptOutAt: string | null;
  emailBouncedAt: string | null;
  emailComplainedAt: string | null;
  waOptOutAt: string | null;
  waMarketingOptOutAt: string | null;
};

const EVENT_LABEL: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviado",
  delivered: "Entregue",
  delivery_delayed: "Entrega atrasada",
  opened: "Aberto",
  read: "Lido",
  clicked: "Clicou",
  bounced: "Bounce (e-mail inválido)",
  complained: "Marcado como spam",
  failed: "Falhou",
  converted: "Comprou",
  unsubscribed: "Descadastrou",
  replied: "Respondeu",
};

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Histórico de envios (Desempenho → Histórico), recortado pelo período global. */
export function DeliveryList({ workspaceId, period }: { workspaceId: string; period: RelPeriod }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [q, setQ] = useState("");
  const [tests, setTests] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const dq = useDebounced(q);
  const params = new URLSearchParams({ workspaceId, page: String(page) });
  if (channel) params.set("channel", channel);
  if (status) params.set("status", status);
  if (origin.startsWith("f:")) params.set("flowId", origin.slice(2));
  if (origin.startsWith("c:")) params.set("campaignId", origin.slice(2));
  if (dq) params.set("q", dq);
  if (tests) params.set("tests", "1");
  if (period.dataInicio) params.set("dataInicio", period.dataInicio);
  if (period.dataFim) params.set("dataFim", period.dataFim);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["rel-deliveries", params.toString()],
    queryFn: () => api<ListData>(`/api/atrako/relacionamento/deliveries?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
  useEffect(() => setPage(1), [channel, status, origin, dq, tests, period.qs]);
  const sync = useMutation({
    mutationFn: () => api<{ checked: number; updated: number }>("/api/atrako/relacionamento/deliveries", { body: { workspaceId, action: "sync" } }),
    onSuccess: (r) => {
      setMsg(`${num(r.checked)} e-mails conferidos no Resend, ${num(r.updated)} atualizados.`);
      void qc.invalidateQueries({ queryKey: ["rel-deliveries"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchInput size="toolbar" placeholder="Buscar destinatário ou assunto" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <PillSelect
          value={channel}
          onChange={setChannel}
          options={[
            { value: "", label: "Canal" },
            { value: "EMAIL", label: "E-mail" },
            { value: "WHATSAPP", label: "WhatsApp" },
          ]}
        />
        <PillSelect
          value={status}
          onChange={setStatus}
          options={[{ value: "", label: "Status" }, ...Object.entries(DELIVERY_STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        <PillSelect
          value={origin}
          onChange={setOrigin}
          options={[
            { value: "", label: "Origem" },
            ...(data?.flows ?? []).map((f) => ({ value: `f:${f.id}`, label: f.name })),
            ...(data?.campaigns ?? []).map((c) => ({ value: `c:${c.id}`, label: `Campanha: ${c.name}` })),
          ]}
        />
        <OptionChip className="px-3 py-1.5" selected={tests} onClick={() => setTests((v) => !v)}>
          Testes
        </OptionChip>
        <Button variant="outline" size="toolbar" disabled={sync.isPending} onClick={() => sync.mutate()}>
          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sincronizar
        </Button>
      </div>
      {msg ? <p className="type-caption text-[var(--ink)]">{msg}</p> : null}

      <section className="rel-card">
        {isLoading || !data ? (
          <RelLoading compact />
        ) : data.rows.length ? (
          <>
            <table className="rel-table type-caption" style={isFetching ? { opacity: 0.6 } : undefined}>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Para</th>
                  <th>Mensagem</th>
                  <th>Origem</th>
                  <th>Status</th>
                  <th>Venda</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} data-clickable="true" onClick={() => setOpenId(r.id)}>
                    <td className="whitespace-nowrap tabular-nums">{dateBR(r.sentAt ?? r.createdAt, true)}</td>
                    <td>
                      <span className="block text-[var(--ink)]">{r.contact?.name || r.toAddress || "—"}</span>
                      {r.contact?.name && r.toAddress ? <span className="type-micro-legal text-[var(--ink-muted-48)]">{r.toAddress}</span> : null}
                    </td>
                    <td className="max-w-[280px]">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <ChannelIcon channel={r.channel} />
                        <span className="truncate">{r.channel === "EMAIL" ? r.subject ?? "E-mail" : r.templateName ?? "Modelo"}</span>
                        {r.isTest ? <span className="rel-badge type-micro-legal">teste</span> : null}
                      </span>
                    </td>
                    <td>{r.origin}</td>
                    <td>
                      <span className="rel-badge type-micro-legal" data-tone={deliveryTone(r.status)}>
                        {DELIVERY_STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      {r.error ? <span className="type-micro-legal block max-w-[200px] truncate text-[var(--ink-muted-48)]">{r.error}</span> : null}
                    </td>
                    <td className="tabular-nums">
                      {r.convertedAt ? (
                        <>
                          {brl(r.convertedCents)}
                          <span className="type-micro-legal block text-[var(--ink-muted-48)]">{r.conversionKind === "ATTRIBUTED" ? "atribuída" : "influenciada"}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between">
              <span className="type-fine-print text-[var(--ink-muted-48)]">
                {num(data.total)} envios · página {page} de {pages}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          </>
        ) : (
          <RelEmpty text="Nenhum envio com estes filtros." />
        )}
      </section>
      {openId ? <DeliveryPanel workspaceId={workspaceId} id={openId} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function DeliveryPanel({ workspaceId, id, onClose }: { workspaceId: string; id: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rel-delivery", id],
    queryFn: () => api<Detail>(`/api/atrako/relacionamento/deliveries?workspaceId=${workspaceId}&id=${id}`),
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const d = data?.delivery;
  return (
    <div className="panel-modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="panel-modal" style={{ width: "min(640px, 100%)" }} role="dialog" aria-modal="true" aria-label="Envio">
        <div className="panel-modal-header">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                {d ? `${d.channel === "EMAIL" ? "E-mail" : "WhatsApp"} · ${d.flowName ?? d.campaignName ?? "Avulso"}` : "Envio"}
              </p>
              <h2 className="type-tagline mt-1 truncate text-[var(--ink)]">{isLoading ? "…" : d?.subject ?? d?.templateName ?? "Mensagem"}</h2>
              {d ? (
                <p className="type-caption mt-1 text-[var(--ink-muted-80)]">
                  {d.contact?.name ? `${d.contact.name} · ` : ""}
                  {d.toAddress}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-[var(--ink-muted-48)] active:scale-95" aria-label="Fechar">
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="panel-modal-body">
          {isLoading || !d ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
            </div>
          ) : (
            <>
              <div className="panel-modal-section space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rel-badge type-micro-legal" data-tone={deliveryTone(d.status)}>
                    {DELIVERY_STATUS_LABEL[d.status] ?? d.status}
                  </span>
                  {d.couponCode ? <span className="rel-badge type-micro-legal">Cupom {d.couponCode}</span> : null}
                  {d.costMicros ? <span className="rel-badge type-micro-legal">Custo {brlMicros(d.costMicros)}</span> : null}
                  {d.convertedAt ? (
                    <span className="rel-badge type-micro-legal" data-tone="ok">
                      Venda {brl(d.convertedCents)} ({d.conversionKind === "ATTRIBUTED" ? "atribuída" : "influenciada"})
                    </span>
                  ) : null}
                </div>
                {d.error ? <p className="type-caption text-[var(--ink)]">Erro: {d.error}</p> : null}
                {d.destination ? <p className="type-fine-print truncate text-[var(--ink-muted-48)]">Destino: {d.destination}</p> : null}
                {d.leadId ? (
                  <Link href={`/crm/leads/${d.leadId}`} className="type-caption text-[var(--primary)]">
                    Abrir lead no CRM
                  </Link>
                ) : null}
              </div>
              <div className="panel-modal-section">
                <h3 className="type-caption-strong mb-2 text-[var(--ink)]">Linha do tempo</h3>
                <ol className="space-y-1.5 border-l border-[var(--hairline)] pl-3">
                  {d.events.length ? (
                    d.events.map((e) => (
                      <li key={e.id} className="type-caption text-[var(--ink-muted-80)]">
                        <span className="tabular-nums text-[var(--ink-muted-48)]">{dateBR(e.at, true)}</span> · {EVENT_LABEL[e.type] ?? e.type}
                        {typeof e.meta?.link === "string" ? <span className="type-micro-legal block truncate text-[var(--ink-muted-48)]">{e.meta.link}</span> : null}
                      </li>
                    ))
                  ) : (
                    <li className="type-caption text-[var(--ink-muted-48)]">Sem eventos ainda.</li>
                  )}
                </ol>
              </div>
              <div className="panel-modal-section">
                <h3 className="type-caption-strong mb-2 text-[var(--ink)]">Como chegou</h3>
                {data?.preview?.html ? (
                  <iframe title="E-mail enviado" className="rel-preview-frame" sandbox="" srcDoc={data.preview.html} />
                ) : data?.preview?.text ? (
                  <div className="rel-wa-stage">
                    <div className="rel-wa-bubble type-caption text-[var(--ink)]">{data.preview.text}</div>
                  </div>
                ) : (
                  <p className="type-caption text-[var(--ink-muted-48)]">Prévia indisponível.</p>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

/** Supressão (Contatos): quem não recebe mais e por quê. */
export function SuppressionList({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const key = ["rel-suppression", workspaceId, kind, dq];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ rows: Suppressed[]; total: number }>(
        `/api/atrako/relacionamento/deliveries?workspaceId=${workspaceId}&view=suppression&kind=${kind}&q=${encodeURIComponent(dq)}`,
      ),
  });
  const unsuppress = useMutation({
    mutationFn: (b: { contactId: string; kind: string }) => api("/api/atrako/relacionamento/deliveries", { body: { workspaceId, action: "unsuppress", ...b } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["rel-suppression", workspaceId] }),
  });
  return (
    <RelSection
      title="Não recebem mais"
      info="Descadastros, e-mails inválidos (bounce), marcações de spam e quem saiu do WhatsApp. Só reative com pedido do próprio cliente. Spam não pode ser revertido."
      action={data ? <span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">{num(data.total)}</span> : null}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchInput size="toolbar" placeholder="Buscar contato" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <PillSelect
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "Todos os motivos" },
            { value: "optout", label: "Descadastro de e-mail" },
            { value: "bounce", label: "Bounce" },
            { value: "complaint", label: "Spam" },
            { value: "wa", label: "Saiu do WhatsApp" },
          ]}
        />
      </div>
      <div>
        {isLoading || !data ? (
          <RelLoading compact />
        ) : data.rows.length ? (
          <table className="rel-table type-caption">
            <thead>
              <tr>
                <th>Contato</th>
                <th>Motivo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const reasons = [
                  r.emailOptOutAt ? { kind: "optout", label: `Descadastrou ${dateBR(r.emailOptOutAt)}` } : null,
                  r.emailBouncedAt ? { kind: "bounce", label: `Bounce ${dateBR(r.emailBouncedAt)}` } : null,
                  r.emailComplainedAt ? { kind: "complaint", label: `Spam ${dateBR(r.emailComplainedAt)}` } : null,
                  r.waOptOutAt || r.waMarketingOptOutAt ? { kind: "wa", label: `Saiu do WhatsApp ${dateBR(r.waOptOutAt ?? r.waMarketingOptOutAt)}` } : null,
                ].filter(Boolean) as Array<{ kind: string; label: string }>;
                return (
                  <tr key={r.id}>
                    <td>
                      <span className="block text-[var(--ink)]">{r.name || r.email || r.phone}</span>
                      <span className="type-micro-legal text-[var(--ink-muted-48)]">{[r.email, r.phone].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td>
                      {reasons.map((x) => (
                        <span key={x.kind} className="rel-badge type-micro-legal mr-1" data-tone="bad">
                          {x.label}
                        </span>
                      ))}
                    </td>
                    <td className="text-right">
                      {reasons
                        .filter((x) => x.kind !== "complaint")
                        .map((x) => (
                          <Button
                            key={x.kind}
                            variant="ghost"
                            disabled={unsuppress.isPending}
                            onClick={() => {
                              if (window.confirm("O cliente pediu para voltar a receber? Reative só com pedido dele.")) unsuppress.mutate({ contactId: r.id, kind: x.kind });
                            }}
                          >
                            Reativar {x.kind === "wa" ? "WhatsApp" : "e-mail"}
                          </Button>
                        ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <RelEmpty text="Ninguém bloqueado." />
        )}
        {data && data.total > data.rows.length ? (
          <p className="type-fine-print mt-2 text-[var(--ink-muted-48)]">Mostrando {num(data.rows.length)} de {num(data.total)}.</p>
        ) : null}
      </div>
    </RelSection>
  );
}
