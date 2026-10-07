"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, Circle, History, Loader2, Mail, MessageCircle, MoreHorizontal, Sparkles, X } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink, Button, OptionChip, PillSelect, SegmentedControl, Switch } from "@/components/ui";
import { EmailBlockEditor } from "@/components/relacionamento/EmailBlockEditor";
import { MessagePhone, type PhoneItem } from "@/components/relacionamento/phone/MessagePhone";
import { WizardLayout } from "@/components/symbius/wizard-ui";
import { RelSection } from "@/components/relacionamento/ui";
import { relResultsHref } from "@/components/relacionamento/nav";
import { STAGES, STAGE_LABEL, campaignStage, statusTone, type StepKey } from "@/components/relacionamento/campaignStage";
import { api, brl, brlMicros, dateBR, daysUntil, num, pct, timeAgo } from "@/components/relacionamento/format";
import { WA_EXAMPLE_PARAMS, waPreviewFromComponents, waPreviewFromDraft } from "@/lib/flows/wa-preview";
import type { EmailContent, WhatsAppContent } from "@/lib/flows/types";

type Audience = {
  lifecycles?: string[];
  productTitles?: string[];
  minSpentCents?: number | null;
  inactiveDays?: number | null;
  birthdayMonth?: number | null;
  consentOnly?: boolean;
  excludeRecentDays?: number | null;
  excludeCustomers?: boolean;
};
type Briefing = {
  objective?: string;
  offer?: string;
  audienceNote?: string;
  products?: string[];
  tone?: string;
  references?: string;
  suggestedSendAt?: string;
};
type Campaign = {
  id: string;
  name: string;
  channel: "EMAIL" | "WHATSAPP" | "BOTH";
  status: string;
  statusLabel: string;
  briefing: Briefing | null;
  audience: Audience | null;
  content: { email?: EmailContent; whatsapp?: WhatsAppContent } | null;
  waTemplateRefId: string | null;
  couponCode: string | null;
  checklist: { couponConfirmed?: boolean; audienceReviewed?: boolean } | null;
  eventDate: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  ownerMemberId: string | null;
  approverMemberId: string | null;
  testedAt: string | null;
  contentUpdatedAt: string | null;
  recipientsCount: number | null;
  calendarKey: string | null;
};
type Member = { id: string; name: string | null; email: string; role: string };
type Comment = { id: string; memberId: string | null; authorName: string | null; kind: string; body: string; createdAt: string };
type Template = { id: string; name: string; status: string; category: string | null; purpose: string | null; components: unknown };
type Estimate = {
  total: number;
  email: number;
  whatsapp: number;
  reachable: number;
  waCostCents: number;
  waRateMicros: number | null;
  waCapacity: { limit: number | null; used: number; campaignLeft: number | null } | null;
  emailWarmupCap: number | null;
  emailDays: number;
  waDays: number | null;
};
type SampleRow = { id: string; name: string | null; email: string | null; phone: string | null; profile: { lifecycle: string; totalSpentCents: number } | null };
type Count = { total: number; email: number; whatsapp: number; reachable: number };
type Results = {
  byChannel: Array<{ channel: string; sent: number; delivered: number; opened: number; clicked: number; bounced: number; costMicros: number }>;
  attributed: { orders: number; cents: number };
  influenced: { orders: number; cents: number };
};
type Detail = {
  campaign: Campaign;
  checklist: Array<{ key: string; label: string; ok: boolean; detail?: string }>;
  estimate: Estimate;
  comments: Comment[];
  members: Member[];
  templates: Template[];
  sample: SampleRow[];
  results: Results | null;
  canApprove: boolean;
  me: { memberId: string | null; email: string | null };
  store?: { name: string; logoUrl: string | null };
};
type Body = Record<string, unknown>;
type Autosave = (body: Body, delay?: number) => void;
type Action = <T = Body>(body: Body) => Promise<T>;

const CHANNELS = [
  { value: "EMAIL", label: "E-mail", hint: "Visual completo, custo zero" },
  { value: "WHATSAPP", label: "WhatsApp", hint: "Mais lido; modelo aprovado pela Meta" },
  { value: "BOTH", label: "Os dois", hint: "WhatsApp + e-mail na mesma campanha" },
] as const;
const CHANNEL_LABEL: Record<string, string> = { EMAIL: "E-mail", WHATSAPP: "WhatsApp", BOTH: "E-mail + WhatsApp" };
const LIFECYCLES = [
  { value: "LEAD", label: "Leads (sem compra)" },
  { value: "NOVO", label: "Clientes novos" },
  { value: "RECORRENTE", label: "Recorrentes" },
  { value: "VIP", label: "VIP" },
  { value: "EM_RISCO", label: "Em risco" },
  { value: "INATIVO", label: "Inativos" },
  { value: "PERDIDO", label: "Perdidos" },
];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const KIND_LABEL: Record<string, string> = { SISTEMA: "Sistema", AJUSTES: "Ajustes", APROVACAO: "Agendamento", COMENTARIO: "" };

function defaultStep(status: string): StepKey {
  const s = campaignStage(status);
  return s === "criar" ? "criar" : s === "agendar" || s === "enviada" ? "agendar" : "planejar";
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function mergeBody(a: Body, b: Body): Body {
  const out: Body = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = a[k];
    out[k] =
      v && typeof v === "object" && !Array.isArray(v) && prev && typeof prev === "object" && !Array.isArray(prev)
        ? { ...(prev as Body), ...(v as Body) }
        : v;
  }
  return out;
}

function hasAdvancedFilters(a: Audience | null) {
  return Boolean(a && (a.minSpentCents || a.inactiveDays || a.birthdayMonth || a.productTitles?.length || a.excludeRecentDays || a.excludeCustomers));
}

// --------------------------------------------------------------------------- página

export function CampaignDetail({ workspaceId, id }: { workspaceId: string; id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const key = ["rel-campaign", id];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => api<Detail>(`/api/atrako/relacionamento/campaigns/${id}?workspaceId=${workspaceId}`),
  });
  const [step, setStep] = useState<StepKey | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const pending = useRef<Body>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data && !step) setStep(defaultStep(data.campaign.status));
  }, [data, step]);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["rel-campaign", id] });
    void qc.invalidateQueries({ queryKey: ["rel-campaigns", workspaceId] });
  }, [qc, id, workspaceId]);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    setSaveState("saving");
    try {
      await api(`/api/atrako/relacionamento/campaigns/${id}`, { method: "PATCH", body: { workspaceId, ...body } });
      setSaveState("saved");
      refresh();
    } catch (e) {
      setSaveState("error");
      setMsg(e instanceof Error ? e.message : "Não foi possível salvar");
    }
  }, [id, workspaceId, refresh]);

  const autosave: Autosave = useCallback(
    (body, delay = 800) => {
      pending.current = mergeBody(pending.current, body);
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  useEffect(() => () => void flush(), [flush]);

  const action: Action = useCallback(
    async <T,>(body: Body) => {
      await flush();
      return api<T>(`/api/atrako/relacionamento/campaigns/${id}`, { body: { workspaceId, ...body } });
    },
    [flush, id, workspaceId],
  );

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };
  const transition = (to: string, extra: Body = {}, done?: string) =>
    run(to, async () => {
      await action({ action: "transition", to, ...extra });
      return done;
    });

  if (isLoading || !data || !step) {
    return (
      <AppPage title="Campanha">
        {error ? (
          <p className="type-caption text-[var(--ink)]">{(error as Error).message}</p>
        ) : (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          </div>
        )}
      </AppPage>
    );
  }

  const c = data.campaign;
  const sent = c.status === "ENVIANDO" || c.status === "ENVIADA";
  const scheduled = c.status === "AGENDADA";
  const cancelled = c.status === "PERDIDA";
  const readOnly = sent || scheduled || cancelled;
  const left = c.eventDate ? daysUntil(c.eventDate) : null;
  const storeName = data.store?.name || "Sua loja";
  const storeLogo = data.store?.logoUrl ?? null;

  const goTo = async (s: StepKey) => {
    await flush();
    if (s !== "planejar" && (c.status === "IDEIA" || c.status === "BRIEFING")) {
      await action({ action: "transition", to: "start_creation" }).catch(() => null);
      refresh();
    }
    setStep(s);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppPage
      title={
        <div className="min-w-0">
          <BackLink href="/relacionamento?tab=campanhas">Campanhas</BackLink>
          <NameField value={c.name} disabled={readOnly} onCommit={(name) => autosave({ name }, 0)} />
          <p className="flex flex-wrap items-center gap-x-2 type-fine-print text-[var(--ink-muted-48)]">
            <span>{CHANNEL_LABEL[c.channel]}</span>
            <span>·</span>
            <span>
              {c.eventDate ? `${dateBR(c.eventDate)}${left != null && left >= 0 && !sent ? ` (em ${left} dias)` : ""}` : "Sem data"}
            </span>
            <SaveIndicator state={saveState} />
          </p>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <span className="rel-badge type-micro-legal" data-tone={statusTone(c.status)}>
            {STAGE_LABEL[c.status] ?? c.statusLabel}
          </span>
          <Button variant="ghost" size="toolbar" onClick={() => setHistoryOpen(true)}>
            <History className="h-4 w-4" />
            Histórico{data.comments.length ? ` (${data.comments.length})` : ""}
          </Button>
          <MoreMenu
            items={[
              ...(!sent && !cancelled
                ? [{ label: "Cancelar campanha", danger: true, onClick: () => window.confirm("Cancelar esta campanha? Ela não será enviada.") && void transition("cancel", {}, "Campanha cancelada.") }]
                : []),
              ...(cancelled ? [{ label: "Reabrir campanha", onClick: () => void transition("start_creation", {}, "Campanha reaberta.").then(() => setStep("criar")) }] : []),
              ...(!sent && !scheduled
                ? [
                    {
                      label: "Excluir",
                      danger: true,
                      onClick: () => {
                        if (!window.confirm("Excluir a campanha? Não dá para desfazer.")) return;
                        void run("delete", async () => {
                          await action({ action: "delete" });
                          router.push("/relacionamento?tab=campanhas");
                        });
                      },
                    },
                  ]
                : []),
            ]}
          />
        </div>
      }
    >
      {sent ? (
        <SentView workspaceId={workspaceId} c={c} results={data.results} />
      ) : (
        <div className="flex flex-col gap-4">
          <Stepper current={step} status={c.status} onGo={(s) => void goTo(s)} />

          {scheduled ? (
            <section className="rel-result-tile">
              <div>
                <p className="type-caption text-[var(--on-dark)]">Agendada</p>
                <p className="type-tagline text-[var(--on-dark)]">
                  {dateBR(c.scheduledAt, true)} · {num(c.recipientsCount ?? 0)} contatos
                </p>
                <p className="type-fine-print text-[var(--on-dark)] opacity-70">Para mudar qualquer coisa, cancele o agendamento. Depois é só agendar de novo.</p>
              </div>
              <Button variant="outline" size="toolbar" disabled={!!busy} onClick={() => void transition("unschedule", {}, "Agendamento cancelado. Edite e agende de novo.")}>
                {busy === "unschedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancelar agendamento
              </Button>
            </section>
          ) : null}
          {cancelled ? (
            <section className="rel-card flex flex-wrap items-center justify-between gap-3">
              <p className="type-caption text-[var(--ink)]">Campanha cancelada — não será enviada.</p>
              <Button variant="outline" size="toolbar" onClick={() => void transition("start_creation", {}, "Campanha reaberta.").then(() => setStep("criar"))}>
                Reabrir
              </Button>
            </section>
          ) : null}
          {msg ? <p className="rel-card type-caption text-[var(--ink)]">{msg}</p> : null}

          {step === "planejar" ? (
            <PlanStep c={c} sample={data.sample} members={data.members} readOnly={readOnly} autosave={autosave} action={action} onNext={() => void goTo("criar")} />
          ) : null}
          {step === "criar" ? (
            <CreateStep
              workspaceId={workspaceId}
              data={data}
              readOnly={readOnly}
              storeName={storeName}
              storeLogo={storeLogo}
              autosave={autosave}
              action={action}
              onRefresh={refresh}
              onBack={() => void goTo("planejar")}
              onNext={() => void goTo("agendar")}
            />
          ) : null}
          {step === "agendar" ? (
            <ScheduleStep
              workspaceId={workspaceId}
              data={data}
              readOnly={readOnly}
              busy={busy}
              autosave={autosave}
              run={run}
              action={action}
              onBack={() => void goTo("criar")}
              onGo={(s) => void goTo(s)}
            />
          ) : null}
        </div>
      )}

      {historyOpen ? (
        <HistoryPanel
          comments={data.comments}
          busy={busy === "comment"}
          onClose={() => setHistoryOpen(false)}
          onSend={(body) => run("comment", async () => void (await action({ action: "comment", body })))}
        />
      ) : null}
    </AppPage>
  );
}

// --------------------------------------------------------------------------- cabeçalho

function NameField({ value, disabled, onCommit }: { value: string; disabled: boolean; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className="type-tagline mt-1 block w-full min-w-0 truncate rounded-[var(--radius-xs)] border border-transparent bg-transparent px-1 -mx-1 text-[var(--ink)] focus:border-[var(--hairline)] focus:outline-none"
      value={v}
      disabled={disabled}
      aria-label="Nome da campanha"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v.trim() !== value && onCommit(v.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1">
      ·{" "}
      {state === "saving" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
        </>
      ) : state === "saved" ? (
        <>
          <Check className="h-3 w-3 text-[var(--success)]" /> Salvo
        </>
      ) : (
        <span className="text-[var(--danger)]">Não salvou</span>
      )}
    </span>
  );
}

function Stepper({ current, status, onGo }: { current: StepKey; status: string; onGo: (s: StepKey) => void }) {
  const stage = campaignStage(status);
  const reached = stage === "planejar" ? 0 : stage === "criar" ? 1 : 2;
  return (
    <nav className="rel-stepper" aria-label="Passos da campanha">
      {STAGES.map((s, i) => {
        const done = i < reached || (stage === "agendar" && i === 2 && status === "AGENDADA");
        return (
          <div key={s.key} className="contents">
            {i > 0 ? <span className="rel-stepper-line" data-done={i <= reached} /> : null}
            <button type="button" className="rel-stepper-item active:scale-95" data-current={current === s.key} data-done={done} onClick={() => onGo(s.key)}>
              <span className="rel-setup-num" data-done={done} data-next={current === s.key && !done}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="type-caption-strong">{s.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

function MoreMenu({ items }: { items: Array<{ label: string; danger?: boolean; onClick: () => void }> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  if (!items.length) return null;
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="toolbar" aria-label="Mais ações" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="rel-menu" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className="rel-menu-item type-caption"
              data-danger={it.danger}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActionBar({ back, primary, note }: { back?: { label: string; onClick: () => void }; primary?: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="rel-action-bar">
      <div className="flex min-w-0 items-center gap-3">
        {back ? (
          <Button variant="ghost" size="toolbar" onClick={back.onClick}>
            {back.label}
          </Button>
        ) : null}
        {note ? <span className="type-fine-print text-[var(--ink-muted-48)]">{note}</span> : null}
      </div>
      {primary}
    </div>
  );
}

// --------------------------------------------------------------------------- 1. Planejar

function PlanStep({
  c,
  sample,
  members,
  readOnly,
  autosave,
  action,
  onNext,
}: {
  c: Campaign;
  sample: SampleRow[];
  members: Member[];
  readOnly: boolean;
  autosave: Autosave;
  action: Action;
  onNext: () => void;
}) {
  const [channel, setChannel] = useState<string>(c.channel);
  const [eventDate, setEventDate] = useState(c.eventDate ? c.eventDate.slice(0, 10) : "");
  const [b, setB] = useState<Briefing>(c.briefing ?? {});
  const [coupon, setCoupon] = useState(c.couponCode ?? "");
  const [owner, setOwner] = useState(c.ownerMemberId ?? "");
  const [a, setA] = useState<Audience>(c.audience ?? {});
  const [advanced, setAdvanced] = useState(() => hasAdvancedFilters(c.audience));
  const [count, setCount] = useState<Count | null>(null);
  const [rows, setRows] = useState<SampleRow[]>(sample);

  const sig = JSON.stringify({ a, channel });
  useEffect(() => {
    const t = setTimeout(() => {
      const { a: aud, channel: ch } = JSON.parse(sig) as { a: Audience; channel: string };
      action<{ count: Count; sample: SampleRow[] }>({ action: "count", audience: aud, channel: ch })
        .then((r) => {
          setCount(r.count);
          setRows(r.sample);
        })
        .catch(() => null);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const brief = (p: Partial<Briefing>) => {
    setB((cur) => ({ ...cur, ...p }));
    autosave({ briefing: p });
  };
  const aud = (p: Partial<Audience>) => {
    const next = { ...a, ...p };
    setA(next);
    autosave({ audience: next });
  };
  const lifecycles = a.lifecycles ?? [];
  const names = rows
    .map((r) => (r.name || r.email || "").split(/[\s@]/)[0])
    .filter(Boolean)
    .slice(0, 4);

  return (
    <>
      <div className="grid gap-4 desktop:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <RelSection title="Por onde enviar">
            <div className="grid gap-2 sm:grid-cols-3">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  className="rel-channel-card active:scale-95"
                  data-selected={channel === ch.value}
                  disabled={readOnly}
                  onClick={() => {
                    setChannel(ch.value);
                    autosave({ channel: ch.value }, 0);
                  }}
                >
                  <span className="flex gap-1">
                    {ch.value !== "WHATSAPP" ? (
                      <span className="rel-mini-dot">
                        <Mail className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    {ch.value !== "EMAIL" ? (
                      <span className="rel-mini-dot">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </span>
                  <span className="type-caption-strong text-[var(--ink)]">{ch.label}</span>
                  <span className="type-micro-legal text-[var(--ink-muted-48)]">{ch.hint}</span>
                </button>
              ))}
            </div>
          </RelSection>

          <RelSection title="A ideia">
            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="rel-label type-fine-print">O que você quer comunicar?</span>
                <textarea
                  className="rel-textarea type-caption"
                  rows={3}
                  disabled={readOnly}
                  placeholder="ex.: lançamento da coleção de verão, com foco nas peças leves"
                  value={b.objective ?? ""}
                  onChange={(e) => brief({ objective: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="rel-label type-fine-print">Oferta (opcional)</span>
                  <input
                    className="rel-input type-caption"
                    disabled={readOnly}
                    placeholder="ex.: 15% off, frete grátis acima de R$ 199"
                    value={b.offer ?? ""}
                    onChange={(e) => brief({ offer: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="rel-label type-fine-print">Cupom (opcional)</span>
                  <input
                    className="rel-input type-caption uppercase"
                    disabled={readOnly}
                    placeholder="ex.: VERAO15"
                    value={coupon}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
                      setCoupon(v);
                      autosave({ couponCode: v });
                    }}
                  />
                </label>
              </div>
              <label className="block">
                <span className="rel-label type-fine-print">Produtos em destaque (separe por vírgula)</span>
                <input
                  className="rel-input type-caption"
                  disabled={readOnly}
                  placeholder="ex.: Vestido Linho, Sandália Praia"
                  value={(b.products ?? []).join(", ")}
                  onChange={(e) => brief({ products: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="rel-label type-fine-print">Data da campanha</span>
                  <input
                    className="rel-input type-caption"
                    type="date"
                    disabled={readOnly}
                    value={eventDate}
                    onChange={(e) => {
                      setEventDate(e.target.value);
                      autosave({ eventDate: e.target.value ? `${e.target.value}T12:00:00` : "" }, 0);
                    }}
                  />
                </label>
                <div>
                  <span className="rel-label type-fine-print">Responsável</span>
                  <PillSelect
                    size="field"
                    value={owner}
                    disabled={readOnly}
                    onChange={(v) => {
                      setOwner(v);
                      autosave({ ownerMemberId: v }, 0);
                    }}
                    options={[{ value: "", label: "Ninguém" }, ...members.map((m) => ({ value: m.id, label: m.name || m.email }))]}
                    aria-label="Responsável"
                  />
                </div>
              </div>
            </div>
          </RelSection>
        </div>

        <RelSection title="Para quem" className="h-fit desktop:sticky desktop:top-4">
          <div className="flex flex-col gap-4">
            <div>
              <span className="rel-big-count">{count ? num(count.reachable) : "…"}</span>
              <p className="type-caption text-[var(--ink-muted-80)]">pessoas vão receber</p>
              {count ? (
                <p className="mt-1 flex flex-wrap gap-x-3 type-fine-print text-[var(--ink-muted-48)]">
                  {channel !== "WHATSAPP" ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {num(count.email)}
                    </span>
                  ) : null}
                  {channel !== "EMAIL" ? (
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> {num(count.whatsapp)}
                    </span>
                  ) : null}
                  {names.length ? <span>ex.: {names.join(", ")}</span> : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <OptionChip className="px-3 py-1.5" selected={!lifecycles.length} onClick={() => !readOnly && aud({ lifecycles: [] })}>
                Toda a base
              </OptionChip>
              {LIFECYCLES.map((l) => (
                <OptionChip
                  key={l.value}
                  className="px-3 py-1.5"
                  selected={lifecycles.includes(l.value)}
                  onClick={() =>
                    !readOnly && aud({ lifecycles: lifecycles.includes(l.value) ? lifecycles.filter((x) => x !== l.value) : [...lifecycles, l.value] })
                  }
                >
                  {l.label}
                </OptionChip>
              ))}
            </div>
            <div className="border-t border-[var(--divider-soft)] pt-3">
              <button type="button" className="inline-flex items-center gap-1 type-fine-print text-[var(--ink-muted-80)]" onClick={() => setAdvanced((v) => !v)}>
                {advanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Filtros avançados
              </button>
              {advanced ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="rel-label type-fine-print">Gastou pelo menos (R$)</span>
                      <input
                        className="rel-input type-caption"
                        inputMode="numeric"
                        disabled={readOnly}
                        value={a.minSpentCents ? String(a.minSpentCents / 100) : ""}
                        onChange={(e) => aud({ minSpentCents: e.target.value ? Math.round(Number(e.target.value.replace(",", ".")) * 100) || null : null })}
                      />
                    </label>
                    <label>
                      <span className="rel-label type-fine-print">Sem comprar há (dias)</span>
                      <input
                        className="rel-input type-caption"
                        inputMode="numeric"
                        disabled={readOnly}
                        value={a.inactiveDays ?? ""}
                        onChange={(e) => aud({ inactiveDays: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null })}
                      />
                    </label>
                  </div>
                  <div>
                    <span className="rel-label type-fine-print">Aniversariantes do mês</span>
                    <PillSelect
                      size="field"
                      value={a.birthdayMonth ? String(a.birthdayMonth) : ""}
                      disabled={readOnly}
                      onChange={(v) => aud({ birthdayMonth: v ? Number(v) : null })}
                      options={[{ value: "", label: "Qualquer" }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))]}
                      aria-label="Mês de aniversário"
                    />
                  </div>
                  <label className="block">
                    <span className="rel-label type-fine-print">Comprou produtos que contenham</span>
                    <input
                      className="rel-input type-caption"
                      disabled={readOnly}
                      placeholder="separe por vírgula"
                      value={(a.productTitles ?? []).join(", ")}
                      onChange={(e) => aud({ productTitles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    />
                  </label>
                  <PillSelect
                    size="field"
                    value={String(a.excludeRecentDays ?? 0)}
                    disabled={readOnly}
                    onChange={(v) => aud({ excludeRecentDays: Number(v) || null })}
                    options={[
                      { value: "0", label: "Incluir quem recebeu campanha recente" },
                      { value: "3", label: "Pular quem recebeu nos últimos 3 dias" },
                      { value: "7", label: "Pular quem recebeu nos últimos 7 dias" },
                      { value: "14", label: "Pular quem recebeu nos últimos 14 dias" },
                    ]}
                    aria-label="Campanhas recentes"
                  />
                  <label className="flex items-center justify-between gap-3 type-caption text-[var(--ink-muted-80)]">
                    Só quem nunca comprou
                    <Switch checked={Boolean(a.excludeCustomers)} disabled={readOnly} onChange={(on) => aud({ excludeCustomers: on })} aria-label="Só quem nunca comprou" />
                  </label>
                </div>
              ) : null}
              <p className="mt-3 type-micro-legal text-[var(--ink-muted-48)]">
                Sempre ficam de fora: descadastrados, e-mails com erro, quem marcou spam e quem não aceitou receber.
              </p>
            </div>
          </div>
        </RelSection>
      </div>
      <ActionBar
        primary={
          <Button size="toolbar" onClick={onNext}>
            Continuar: criar a mensagem
          </Button>
        }
      />
    </>
  );
}

// --------------------------------------------------------------------------- 2. Criar

function CreateStep({
  workspaceId,
  data,
  readOnly,
  storeName,
  storeLogo,
  autosave,
  action,
  onRefresh,
  onBack,
  onNext,
}: {
  workspaceId: string;
  data: Detail;
  readOnly: boolean;
  storeName: string;
  storeLogo: string | null;
  autosave: Autosave;
  action: Action;
  onRefresh: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const c = data.campaign;
  const wantsEmail = c.channel !== "WHATSAPP";
  const wantsWa = c.channel !== "EMAIL";
  const [tab, setTab] = useState<"email" | "whatsapp">(wantsEmail ? "email" : "whatsapp");
  const [email, setEmail] = useState<EmailContent>(c.content?.email ?? { subject: c.name, blocks: [] });
  const [subjects, setSubjects] = useState<string[]>([]);
  const [waDraft, setWaDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  useEffect(() => {
    setTestEmail(localStorage.getItem("rel-test-email") ?? data.me.email ?? "");
    setTestPhone(localStorage.getItem("rel-test-phone") ?? "");
  }, [data.me.email]);
  const activeTab = wantsEmail && wantsWa ? tab : wantsEmail ? "email" : "whatsapp";

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };
  const setEmailAndSave = (v: EmailContent, delay = 1200) => {
    setEmail(v);
    autosave({ content: { email: v } }, delay);
  };
  const testFresh = Boolean(c.testedAt && (!c.contentUpdatedAt || c.testedAt >= c.contentUpdatedAt));

  return (
    <>
      <section className="rel-card flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="type-body-strong text-[var(--ink)]">Escreva a mensagem</h3>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {c.briefing?.objective ? `Ideia: ${c.briefing.objective}` : "Dica: preencha a ideia no passo Planejar para a IA escrever melhor."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {wantsEmail && wantsWa ? (
            <SegmentedControl
              aria-label="Canal"
              value={activeTab}
              onChange={setTab}
              options={[
                { value: "email", label: "E-mail" },
                { value: "whatsapp", label: "WhatsApp" },
              ]}
            />
          ) : null}
          <Button
            variant="outline"
            size="toolbar"
            disabled={readOnly || busy === "ai"}
            onClick={() =>
              run("ai", async () => {
                const r = await action<{ suggestion: { subjects: string[]; email: EmailContent; whatsapp: string } }>({ action: "ai_copy" });
                setSubjects(r.suggestion.subjects);
                if (wantsEmail) setEmailAndSave(r.suggestion.email, 0);
                if (wantsWa) setWaDraft(r.suggestion.whatsapp);
                return "Texto sugerido pela IA. Ajuste o que quiser — salva sozinho.";
              })
            }
          >
            {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Escrever com IA
          </Button>
        </div>
      </section>
      {msg ? <p className="rel-card type-caption text-[var(--ink)]">{msg}</p> : null}
      {subjects.length && activeTab === "email" ? (
        <section className="rel-card flex flex-wrap items-center gap-1.5">
          <span className="type-fine-print mr-1 text-[var(--ink-muted-48)]">Assuntos sugeridos:</span>
          {subjects.map((s) => (
            <OptionChip key={s} className="px-3 py-1.5" selected={email.subject === s} onClick={() => setEmailAndSave({ ...email, subject: s }, 0)}>
              {s}
            </OptionChip>
          ))}
        </section>
      ) : null}

      {activeTab === "email" ? (
        <section className="rel-card">
          <EmailBlockEditor
            workspaceId={workspaceId}
            value={email}
            readOnly={readOnly}
            hasCoupon={Boolean(c.couponCode)}
            onChange={(v) => setEmailAndSave(v)}
            preview={(content) => action<{ html: string; bytes: number; clipped: boolean }>({ action: "preview", content })}
          />
        </section>
      ) : (
        <WaEditor
          workspaceId={workspaceId}
          c={c}
          templates={data.templates}
          readOnly={readOnly}
          storeName={storeName}
          storeLogo={storeLogo}
          emailSubject={wantsEmail ? email.subject : null}
          draft={waDraft}
          onDraft={setWaDraft}
          autosave={autosave}
          onRefresh={onRefresh}
          onMsg={setMsg}
        />
      )}

      <section className="rel-card flex flex-wrap items-end gap-3">
        <div className="w-full">
          <h3 className="type-body-strong text-[var(--ink)]">Teste antes de enviar</h3>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {wantsEmail
              ? c.testedAt
                ? `Último teste ${timeAgo(c.testedAt)}${testFresh ? "" : " — antes da última edição, envie de novo"}`
                : "O e-mail precisa de um teste depois da última edição para poder agendar."
              : "Veja no seu celular como a mensagem chega."}
          </p>
        </div>
        {wantsEmail ? (
          <label className="min-w-[200px] flex-1">
            <span className="rel-label type-fine-print">Seu e-mail</span>
            <input className="rel-input type-caption" inputMode="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          </label>
        ) : null}
        {wantsWa ? (
          <label className="min-w-[200px] flex-1">
            <span className="rel-label type-fine-print">Seu WhatsApp</span>
            <input className="rel-input type-caption" inputMode="tel" placeholder="11 99999-9999" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          </label>
        ) : null}
        <Button
          variant="outline"
          size="toolbar"
          disabled={busy === "test" || (!testEmail.trim() && !testPhone.trim())}
          onClick={() =>
            run("test", async () => {
              if (testEmail) localStorage.setItem("rel-test-email", testEmail);
              if (testPhone) localStorage.setItem("rel-test-phone", testPhone);
              const r = await action<{ result: Record<string, { status?: string; reason?: string }> }>({
                action: "test",
                email: wantsEmail ? testEmail : "",
                phone: wantsWa ? testPhone : "",
              });
              onRefresh();
              return (
                Object.entries(r.result)
                  .map(([ch, v]) => `${ch === "email" ? "E-mail" : "WhatsApp"}: ${v.status === "SENT" ? "enviado" : `não enviado (${v.reason ?? v.status})`}`)
                  .join(" · ") || "Nada para testar ainda."
              );
            })
          }
        >
          {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar teste
        </Button>
      </section>

      <ActionBar
        back={{ label: "Voltar", onClick: onBack }}
        primary={
          <Button size="toolbar" onClick={onNext}>
            Continuar: agendar
          </Button>
        }
      />
    </>
  );
}

function WaEditor({
  workspaceId,
  c,
  templates,
  readOnly,
  storeName,
  storeLogo,
  emailSubject,
  draft,
  onDraft,
  autosave,
  onRefresh,
  onMsg,
}: {
  workspaceId: string;
  c: Campaign;
  templates: Template[];
  readOnly: boolean;
  storeName: string;
  storeLogo: string | null;
  emailSubject: string | null;
  draft: string;
  onDraft: (v: string) => void;
  autosave: Autosave;
  onRefresh: () => void;
  onMsg: (m: string) => void;
}) {
  const [selected, setSelected] = useState(c.waTemplateRefId ?? "");
  const [creating, setCreating] = useState(() => !templates.length || Boolean(draft));
  const [buttonText, setButtonText] = useState("Ver na loja");
  const [imageHeader, setImageHeader] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (draft) setCreating(true);
  }, [draft]);
  const params = { ...WA_EXAMPLE_PARAMS, store_name: storeName, ...(c.couponCode ? { coupon_code: c.couponCode } : {}) };
  const tpl = templates.find((t) => t.id === selected);
  const preview = creating && draft.trim() ? waPreviewFromDraft({ body: draft, buttonText, imageHeader }, params) : tpl ? waPreviewFromComponents(tpl.components, params) : null;

  const items: PhoneItem[] = [
    { kind: "trigger", label: c.eventDate ? `Campanha · ${dateBR(c.eventDate)}` : "Campanha" },
    { kind: "whatsapp", id: "wa", preview },
    ...(emailSubject != null ? [{ kind: "email" as const, id: "email", subject: emailSubject || "E-mail" }] : []),
  ];
  const statusLabel = (s: string) => (s === "APPROVED" ? "Aprovado" : s === "PENDING" ? "Em análise" : s === "REJECTED" ? "Recusado" : s.toLowerCase());

  return (
    <WizardLayout
      embedded
      wideForm
      form={
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="type-body-strong text-[var(--ink)]">Mensagem do WhatsApp</h3>
            <p className="type-fine-print text-[var(--ink-muted-48)]">Só modelos aprovados pela Meta podem ser enviados. A aprovação leva de minutos a 24 h.</p>
          </div>
          {templates.length ? (
            <div className="rel-tpl-grid">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="rel-tpl-card"
                  data-selected={!creating && selected === t.id}
                  disabled={readOnly}
                  onClick={() => {
                    setSelected(t.id);
                    setCreating(false);
                    autosave({ waTemplateRefId: t.id }, 0);
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="type-caption-strong truncate text-[var(--ink)]">{t.name}</span>
                    <span className="rel-badge type-micro-legal" data-tone={t.status === "APPROVED" ? "ok" : t.status === "REJECTED" ? "bad" : "warn"}>
                      {statusLabel(t.status)}
                    </span>
                  </span>
                  <span className="rel-tpl-bubble type-fine-print">{waPreviewFromComponents(t.components, params).body || "—"}</span>
                </button>
              ))}
            </div>
          ) : null}
          {!readOnly ? (
            <div className="border-t border-[var(--divider-soft)] pt-3">
              <button type="button" className="inline-flex items-center gap-1 type-caption-strong text-[var(--primary)]" onClick={() => setCreating((v) => !v)}>
                {creating ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Criar modelo novo para esta campanha
              </button>
              {creating ? (
                <div className="mt-3 flex flex-col gap-3">
                  <textarea
                    className="rel-textarea type-caption"
                    rows={5}
                    placeholder="Oi {{first_name}}! Chegou a coleção nova da {{store_name}}…"
                    value={draft}
                    onChange={(e) => onDraft(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 type-caption text-[var(--ink-muted-80)]">
                      Botão
                      <input className="rel-input type-caption w-40" maxLength={25} value={buttonText} onChange={(e) => setButtonText(e.target.value)} aria-label="Texto do botão" />
                    </label>
                    <label className="flex items-center gap-2 type-caption text-[var(--ink-muted-80)]">
                      Foto no topo
                      <Switch checked={imageHeader} onChange={setImageHeader} aria-label="Foto no topo" />
                    </label>
                  </div>
                  <p className="type-micro-legal text-[var(--ink-muted-48)]">
                    Use {"{{first_name}}"}, {"{{store_name}}"} e {"{{coupon_code}}"}. Crie com antecedência: pelo menos 7 dias antes da data.
                  </p>
                  <div>
                    <Button
                      size="toolbar"
                      disabled={!draft.trim() || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api("/api/atrako/relacionamento/templates", {
                            body: {
                              workspaceId,
                              action: "create_custom",
                              campaignId: c.id,
                              category: "MARKETING",
                              body: draft,
                              buttonText,
                              imageHeader,
                              copyCode: Boolean(c.couponCode),
                            },
                          });
                          onDraft("");
                          setCreating(false);
                          onRefresh();
                          onMsg("Modelo enviado para a Meta aprovar. Ele já fica ligado a esta campanha.");
                        } catch (e) {
                          onMsg(e instanceof Error ? e.message : "Erro ao criar o modelo");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Enviar para a Meta aprovar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      }
      preview={<MessagePhone storeName={storeName} avatarUrl={storeLogo} items={items} highlightId="wa" />}
    />
  );
}

// --------------------------------------------------------------------------- 3. Agendar

function ScheduleStep({
  workspaceId,
  data,
  readOnly,
  busy,
  autosave,
  run,
  action,
  onBack,
  onGo,
}: {
  workspaceId: string;
  data: Detail;
  readOnly: boolean;
  busy: string | null;
  autosave: Autosave;
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>;
  action: Action;
  onBack: () => void;
  onGo: (s: StepKey) => void;
}) {
  const c = data.campaign;
  const tomorrow10 = () => {
    const d = new Date(Date.now() + 86_400_000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };
  const [at, setAt] = useState(() => toLocalInput(c.scheduledAt ?? (c.eventDate ? `${c.eventDate.slice(0, 10)}T10:00:00` : tomorrow10())));
  const [confirming, setConfirming] = useState(false);
  const e = data.estimate;
  const items = data.checklist.map((i) =>
    i.key === "audience" ? { ...i, label: "Público com contatos", ok: e.reachable > 0, detail: `${num(e.reachable)} pessoas` } : i,
  );
  const pending = items.filter((i) => !i.ok);
  const resolveStep: Record<string, StepKey> = { email: "criar", wa_template: "criar", test: "criar", audience: "planejar" };
  const atDate = at ? new Date(at) : null;
  const past = atDate ? atDate.getTime() < Date.now() : false;

  const quick = [
    ...(c.eventDate ? [{ label: "No dia, 10h", value: `${c.eventDate.slice(0, 10)}T10:00` }] : []),
    ...(c.eventDate ? [{ label: "Véspera, 18h", value: toLocalInput(new Date(new Date(`${c.eventDate.slice(0, 10)}T18:00:00`).getTime() - 86_400_000).toISOString()) }] : []),
    { label: "Amanhã, 10h", value: toLocalInput(tomorrow10()) },
  ];

  return (
    <>
      <div className="grid gap-4 desktop:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <RelSection title="Antes de agendar">
            <ul className="flex flex-col">
              {items.map((i) => (
                <li key={i.key} className="rel-setup-step">
                  <span className="rel-setup-num" data-done={i.ok}>
                    {i.ok ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="type-caption-strong block text-[var(--ink)]">{i.label}</span>
                    {i.detail ? <span className="type-fine-print block truncate text-[var(--ink-muted-48)]">{i.detail}</span> : null}
                  </span>
                  {!i.ok && !readOnly ? (
                    i.key === "coupon" ? (
                      <Button variant="outline" size="toolbar" onClick={() => autosave({ checklist: { couponConfirmed: true } }, 0)}>
                        Já criei na loja
                      </Button>
                    ) : (
                      <Button variant="outline" size="toolbar" onClick={() => onGo(resolveStep[i.key] ?? "criar")}>
                        Resolver
                      </Button>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          </RelSection>
          <EstimateBlock e={e} channel={c.channel} />
        </div>

        <RelSection title="Quando enviar" className="h-fit desktop:sticky desktop:top-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <OptionChip key={q.label} className="px-3 py-1.5" selected={at === q.value} onClick={() => !readOnly && setAt(q.value)}>
                  {q.label}
                </OptionChip>
              ))}
            </div>
            <input className="rel-input type-caption" type="datetime-local" disabled={readOnly} value={at} onChange={(ev) => setAt(ev.target.value)} aria-label="Data e hora do envio" />
            {past ? <p className="type-fine-print text-[var(--danger)]">Escolha um horário no futuro.</p> : null}
            <p className="type-micro-legal text-[var(--ink-muted-48)]">Respeita o horário silencioso da loja. Envios grandes saem em ondas.</p>
            {e.waDays == null && c.channel !== "EMAIL" ? (
              <p className="type-fine-print text-[var(--ink)]">Sem capacidade de WhatsApp para campanhas agora: o envio sai quando o limite liberar.</p>
            ) : null}
          </div>
        </RelSection>
      </div>

      <ActionBar
        back={{ label: "Voltar", onClick: onBack }}
        note={pending.length && !readOnly ? pending.length > 1 ? `Faltam ${pending.length} itens para agendar` : "Falta 1 item para agendar" : null}
        primary={
          readOnly ? null : (
            <Button size="toolbar" disabled={!!busy || pending.length > 0 || !at || past} onClick={() => setConfirming(true)}>
              Agendar envio
            </Button>
          )
        }
      />

      {confirming && atDate ? (
        <div className="rel-modal" role="presentation" onClick={(ev) => ev.target === ev.currentTarget && setConfirming(false)}>
          <div className="rel-modal-card" role="dialog" aria-modal="true" aria-label="Confirmar agendamento">
            <h2 className="type-tagline">Agendar envio?</h2>
            <p className="rel-big-count mt-4">{num(e.reachable)}</p>
            <p className="type-caption text-[var(--ink-muted-80)]">
              pessoas vão receber por {CHANNEL_LABEL[c.channel].toLowerCase()} em{" "}
              {atDate.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}.
            </p>
            {c.channel !== "EMAIL" && e.waCostCents ? (
              <p className="type-fine-print mt-2 text-[var(--ink-muted-48)]">Custo estimado do WhatsApp: {brl(e.waCostCents)}</p>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" size="toolbar" onClick={() => setConfirming(false)}>
                Voltar
              </Button>
              <Button
                size="toolbar"
                disabled={!!busy}
                onClick={() =>
                  void run("schedule", async () => {
                    await api(`/api/atrako/relacionamento/campaigns/${c.id}`, {
                      method: "PATCH",
                      body: { workspaceId, checklist: { audienceReviewed: true } },
                    });
                    await action({ action: "transition", to: "schedule", scheduledAt: atDate.toISOString(), confirmCount: e.reachable });
                    setConfirming(false);
                    return `Agendada para ${dateBR(atDate.toISOString(), true)}.`;
                  }).finally(() => setConfirming(false))
                }
              >
                {busy === "schedule" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirmar e agendar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EstimateBlock({ e, channel }: { e: Estimate; channel: string }) {
  const wa = channel !== "EMAIL";
  const em = channel !== "WHATSAPP";
  return (
    <div className="rel-kpi-grid">
      <div className="rel-kpi">
        <span className="type-fine-print text-[var(--ink-muted-48)]">Vão receber</span>
        <span className="type-tagline tabular-nums text-[var(--ink)]">{num(e.reachable)}</span>
        <span className="type-micro-legal text-[var(--ink-muted-48)]">
          {em ? `${num(e.email)} e-mail` : ""}
          {em && wa ? " · " : ""}
          {wa ? `${num(e.whatsapp)} WhatsApp` : ""}
        </span>
      </div>
      {wa ? (
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Custo do WhatsApp</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{brl(e.waCostCents)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            {e.waRateMicros ? `${brlMicros(e.waRateMicros)} por mensagem` : "Tabela de preço não cadastrada"}
          </span>
        </div>
      ) : null}
      <div className="rel-kpi">
        <span className="type-fine-print text-[var(--ink-muted-48)]">Tempo para sair tudo</span>
        <span className="type-tagline tabular-nums text-[var(--ink)]">
          {Math.max(em ? e.emailDays : 0, wa ? e.waDays ?? 1 : 0) <= 1 ? "1 dia" : `${Math.max(em ? e.emailDays : 0, wa ? e.waDays ?? 1 : 0)} dias`}
        </span>
        <span className="type-micro-legal text-[var(--ink-muted-48)]">
          {em && e.emailWarmupCap ? `Domínio em aquecimento: ${num(e.emailWarmupCap)}/dia` : wa && e.waCapacity?.limit ? `Limite ${num(e.waCapacity.limit)}/24h` : "Sem limite"}
        </span>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Enviada

function SentView({ workspaceId, c, results }: { workspaceId: string; c: Campaign; results: Results | null }) {
  const sent = results?.byChannel.reduce((s, r) => s + r.sent, 0) ?? 0;
  const delivered = results?.byChannel.reduce((s, r) => s + (r.delivered || r.sent), 0) ?? 0;
  const clicked = results?.byChannel.reduce((s, r) => s + r.clicked, 0) ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <section className="rel-result-tile">
        <div>
          <p className="type-caption text-[var(--on-dark)]">{c.status === "ENVIANDO" ? "Enviando agora" : `Enviada em ${dateBR(c.sentAt, true)}`}</p>
          <p className="type-tagline text-[var(--on-dark)]">{brl(results?.attributed.cents ?? 0)} em vendas vieram desta campanha</p>
        </div>
        <Link href={relResultsHref(workspaceId)} className="type-caption-strong">
          Ver no dashboard
        </Link>
      </section>
      <div className="rel-kpi-grid">
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Enviados</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{num(sent)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">{c.recipientsCount != null ? `de ${num(c.recipientsCount)} previstos` : ""}</span>
        </div>
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Cliques</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{pct(clicked, delivered)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">{num(clicked)} pessoas clicaram</span>
        </div>
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Pedidos</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{num(results?.attributed.orders ?? 0)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">+ {num(results?.influenced.orders ?? 0)} influenciados</span>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Histórico

function HistoryPanel({
  comments,
  busy,
  onClose,
  onSend,
}: {
  comments: Comment[];
  busy: boolean;
  onClose: () => void;
  onSend: (body: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="panel-modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="panel-modal" style={{ width: "min(480px, 100%)" }} role="dialog" aria-modal="true" aria-label="Histórico e comentários">
        <div className="panel-modal-header">
          <div className="flex items-start justify-between gap-3">
            <h2 className="type-tagline text-[var(--ink)]">Histórico e comentários</h2>
            <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-[var(--ink-muted-48)] active:scale-95" aria-label="Fechar">
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="panel-modal-body">
          <div className="panel-modal-section flex flex-col gap-3">
            <textarea className="rel-textarea type-caption" rows={3} placeholder="Escreva um comentário para a equipe…" value={text} onChange={(e) => setText(e.target.value)} />
            <div>
              <Button
                variant="outline"
                size="toolbar"
                disabled={busy || !text.trim()}
                onClick={async () => {
                  await onSend(text);
                  setText("");
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Comentar
              </Button>
            </div>
          </div>
          <div className="panel-modal-section">
            {comments.length ? (
              <ol className="flex flex-col gap-3">
                {[...comments].reverse().map((m) => (
                  <li key={m.id}>
                    <p className="type-fine-print text-[var(--ink-muted-48)]">
                      {m.authorName ?? "Sistema"} · {timeAgo(m.createdAt)}
                      {KIND_LABEL[m.kind] ? ` · ${KIND_LABEL[m.kind]}` : ""}
                    </p>
                    <p className="type-caption whitespace-pre-wrap text-[var(--ink)]">{m.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="type-caption text-[var(--ink-muted-48)]">Nada por aqui ainda.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
