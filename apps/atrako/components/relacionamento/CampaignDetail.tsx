"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Loader2, Sparkles } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink, Button, OptionChip, PillSelect } from "@/components/ui";
import { EmailBlockEditor } from "@/components/relacionamento/EmailBlockEditor";
import { statusTone } from "@/components/relacionamento/CampaignsTab";
import { api, brl, brlMicros, dateBR, daysUntil, num, pct, timeAgo } from "@/components/relacionamento/format";
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
};

const PIPELINE = ["IDEIA", "BRIEFING", "CRIACAO", "REVISAO", "APROVADA", "AGENDADA", "ENVIADA"];
const PIPELINE_LABEL: Record<string, string> = {
  IDEIA: "Ideia",
  BRIEFING: "Briefing",
  CRIACAO: "Criação",
  REVISAO: "Revisão",
  APROVADA: "Aprovada",
  AGENDADA: "Agendada",
  ENVIADA: "Enviada",
};
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
const TABS = [
  { key: "briefing", label: "Briefing" },
  { key: "conteudo", label: "Conteúdo" },
  { key: "publico", label: "Público" },
  { key: "revisao", label: "Revisão" },
  { key: "agendamento", label: "Agendamento" },
  { key: "resultados", label: "Resultados" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function defaultTab(status: string): TabKey {
  if (status === "IDEIA" || status === "BRIEFING") return "briefing";
  if (status === "CRIACAO") return "conteudo";
  if (status === "REVISAO") return "revisao";
  if (status === "APROVADA" || status === "AGENDADA") return "agendamento";
  if (status === "ENVIANDO" || status === "ENVIADA") return "resultados";
  return "briefing";
}

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CampaignDetail({ workspaceId, id }: { workspaceId: string; id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const key = ["rel-campaign", id];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => api<Detail>(`/api/atrako/relacionamento/campaigns/${id}?workspaceId=${workspaceId}`),
  });
  const [tab, setTab] = useState<TabKey | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (data && !tab) setTab(defaultTab(data.campaign.status));
  }, [data, tab]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["rel-campaigns", workspaceId] });
  };
  const patch = async (body: Record<string, unknown>) => {
    await api(`/api/atrako/relacionamento/campaigns/${id}`, { method: "PATCH", body: { workspaceId, ...body } });
    refresh();
  };
  const action = async <T = Record<string, unknown>,>(body: Record<string, unknown>) =>
    api<T>(`/api/atrako/relacionamento/campaigns/${id}`, { body: { workspaceId, ...body } });
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
  const transition = (to: string, extra: Record<string, unknown> = {}, done?: string) =>
    run(to, async () => {
      await action({ action: "transition", to, ...extra });
      return done;
    });

  if (isLoading || !data || !tab) {
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
  const locked = c.status === "ENVIANDO" || c.status === "ENVIADA";
  const idx = PIPELINE.indexOf(c.status === "ENVIANDO" ? "AGENDADA" : c.status);
  const left = c.eventDate ? daysUntil(c.eventDate) : null;
  const memberOptions = [{ value: "", label: "Ninguém" }, ...data.members.map((m) => ({ value: m.id, label: m.name || m.email }))];

  return (
    <AppPage
      title={
        <div className="min-w-0">
          <BackLink href="/relacionamento?tab=campanhas">Campanhas</BackLink>
          <h1 className="type-tagline mt-1 truncate text-[var(--ink)]">{c.name}</h1>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {c.eventDate ? `Data: ${dateBR(c.eventDate)}${left != null && left >= 0 && !locked ? ` · faltam ${left} dias` : ""}` : "Sem data definida"}
            {c.scheduledAt ? ` · envio ${dateBR(c.scheduledAt, true)}` : ""}
          </p>
        </div>
      }
      actions={
        <span className="rel-badge type-micro-legal" data-tone={statusTone(c.status)}>
          {c.statusLabel}
        </span>
      }
    >
      <div className="rel-strip">
        {PIPELINE.map((s, i) => (
          <span key={s} className="inline-flex shrink-0 items-center gap-1 type-fine-print" style={{ color: i <= idx ? "var(--ink)" : "var(--ink-muted-48)" }}>
            {i < idx || c.status === "ENVIADA" ? <Check className="h-3.5 w-3.5 text-[var(--primary)]" /> : <Circle className="h-3 w-3" style={i === idx ? { color: "var(--primary)" } : undefined} />}
            {PIPELINE_LABEL[s]}
            {i < PIPELINE.length - 1 ? <span className="px-1 text-[var(--ink-muted-48)]">·</span> : null}
          </span>
        ))}
        {c.status === "PERDIDA" ? <span className="rel-badge type-micro-legal" data-tone="bad">Perdida</span> : null}
      </div>

      <section className="rel-card flex flex-wrap items-center gap-2">
        {c.status === "IDEIA" ? (
          <Button className="px-4 py-2" disabled={!!busy} onClick={() => transition("start_briefing").then(() => setTab("briefing"))}>
            Começar briefing
          </Button>
        ) : null}
        {["IDEIA", "BRIEFING"].includes(c.status) ? (
          <Button variant={c.status === "IDEIA" ? "outline" : "primary"} className="px-4 py-2" disabled={!!busy} onClick={() => transition("start_creation").then(() => setTab("conteudo"))}>
            Ir para criação
          </Button>
        ) : null}
        {["BRIEFING", "CRIACAO"].includes(c.status) ? (
          <Button variant={c.status === "CRIACAO" ? "primary" : "outline"} className="px-4 py-2" disabled={!!busy} onClick={() => transition("send_review", {}, "Enviada para revisão. O aprovador foi avisado.")}>
            Enviar para revisão
          </Button>
        ) : null}
        {["CRIACAO", "REVISAO"].includes(c.status) && data.canApprove ? (
          <Button className="px-4 py-2" disabled={!!busy} onClick={() => setTab("revisao")}>
            Revisar e aprovar
          </Button>
        ) : null}
        {c.status === "APROVADA" ? (
          <Button className="px-4 py-2" disabled={!!busy} onClick={() => setTab("agendamento")}>
            Agendar envio
          </Button>
        ) : null}
        {c.status === "AGENDADA" ? (
          <Button variant="outline" className="px-4 py-2" disabled={!!busy} onClick={() => transition("unschedule", {}, "Envio desagendado.")}>
            Desagendar
          </Button>
        ) : null}
        {c.status === "PERDIDA" ? (
          <Button className="px-4 py-2" disabled={!!busy} onClick={() => transition("start_briefing")}>
            Reabrir
          </Button>
        ) : null}
        <span className="flex-1" />
        {!locked && c.status !== "PERDIDA" ? (
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() => {
              if (window.confirm("Cancelar esta campanha? Ela vai para Perdidas.")) void transition("cancel", {}, "Campanha cancelada.");
            }}
          >
            Cancelar campanha
          </Button>
        ) : null}
        {["IDEIA", "BRIEFING", "PERDIDA"].includes(c.status) ? (
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() => {
              if (!window.confirm("Excluir a campanha?")) return;
              void run("delete", async () => {
                await action({ action: "delete" });
                router.push("/relacionamento?tab=campanhas");
              });
            }}
          >
            Excluir
          </Button>
        ) : null}
      </section>
      {msg ? <p className="rel-card type-caption text-[var(--ink)]">{msg}</p> : null}

      <div className="grid gap-4 desktop:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <nav className="lp-detail-tabs" aria-label="Etapas da campanha">
            {TABS.map((t) => (
              <button key={t.key} type="button" className="lp-detail-tab" data-active={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
          {tab === "briefing" ? <BriefingTab c={c} locked={locked} memberOptions={memberOptions} onSave={patch} /> : null}
          {tab === "conteudo" ? <ContentTab workspaceId={workspaceId} data={data} locked={locked} onSave={patch} action={action} onRefresh={refresh} /> : null}
          {tab === "publico" ? <AudienceTab c={c} locked={locked} sample={data.sample} onSave={patch} action={action} /> : null}
          {tab === "revisao" ? <ReviewTab data={data} busy={busy} transition={transition} onSave={patch} onGo={setTab} /> : null}
          {tab === "agendamento" ? <ScheduleTab data={data} busy={busy} transition={transition} /> : null}
          {tab === "resultados" ? <ResultsPanel results={data.results} c={c} /> : null}
        </div>
        <Comments comments={data.comments} onSend={(body) => run("comment", async () => void (await action({ action: "comment", body })))} busy={busy === "comment"} />
      </div>
    </AppPage>
  );
}

// --------------------------------------------------------------------------- Briefing

function BriefingTab({
  c,
  locked,
  memberOptions,
  onSave,
}: {
  c: Campaign;
  locked: boolean;
  memberOptions: Array<{ value: string; label: string }>;
  onSave: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(c.name);
  const [channel, setChannel] = useState<string>(c.channel);
  const [eventDate, setEventDate] = useState(c.eventDate ? c.eventDate.slice(0, 10) : "");
  const [b, setB] = useState<Briefing>(c.briefing ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const field = (k: keyof Briefing, label: string, placeholder: string, rows = 2) => (
    <label className="block">
      <span className="rel-label type-fine-print">{label}</span>
      <textarea
        className="rel-textarea type-caption"
        rows={rows}
        disabled={locked}
        placeholder={placeholder}
        value={typeof b[k] === "string" ? (b[k] as string) : ""}
        onChange={(e) => setB({ ...b, [k]: e.target.value })}
      />
    </label>
  );
  return (
    <section className="rel-card space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label>
          <span className="rel-label type-fine-print">Nome</span>
          <input className="rel-input type-caption" disabled={locked} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div>
          <span className="rel-label type-fine-print">Canal</span>
          <PillSelect
            size="field"
            value={channel}
            onChange={setChannel}
            disabled={locked}
            options={[
              { value: "EMAIL", label: "E-mail" },
              { value: "WHATSAPP", label: "WhatsApp" },
              { value: "BOTH", label: "E-mail + WhatsApp" },
            ]}
            aria-label="Canal"
          />
        </div>
        <label>
          <span className="rel-label type-fine-print">Data</span>
          <input className="rel-input type-caption" type="date" disabled={locked} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="rel-label type-fine-print">Responsável</span>
          <PillSelect size="field" value={c.ownerMemberId ?? ""} onChange={(v) => void onSave({ ownerMemberId: v })} options={memberOptions} disabled={locked} aria-label="Responsável" />
        </div>
        <div>
          <span className="rel-label type-fine-print">Aprovador (Dono/Admin)</span>
          <PillSelect size="field" value={c.approverMemberId ?? ""} onChange={(v) => void onSave({ approverMemberId: v })} options={memberOptions} disabled={locked} aria-label="Aprovador" />
        </div>
      </div>
      {field("objective", "Objetivo", "ex.: vender a coleção de Dia das Mães, girar estoque de X")}
      {field("offer", "Oferta", "ex.: 15% com cupom MAES15, frete grátis acima de R$ 199")}
      {field("audienceNote", "Para quem", "ex.: clientes que compraram acessórios nos últimos 12 meses")}
      <label className="block">
        <span className="rel-label type-fine-print">Produtos em destaque (separe por vírgula)</span>
        <input
          className="rel-input type-caption"
          disabled={locked}
          value={(b.products ?? []).join(", ")}
          onChange={(e) => setB({ ...b, products: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </label>
      {field("tone", "Tom", "ex.: carinhoso, urgente, elegante", 1)}
      {field("references", "Referências e observações", "links, campanhas anteriores, o que evitar", 3)}
      <div className="flex items-center gap-3">
        <Button
          className="px-4 py-2"
          disabled={locked || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({ name, channel, eventDate: eventDate ? `${eventDate}T12:00:00` : "", briefing: b });
              setSaved("Briefing salvo.");
            } catch (e) {
              setSaved(e instanceof Error ? e.message : "Erro");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar briefing
        </Button>
        {saved ? <span className="type-caption text-[var(--ink-muted-80)]">{saved}</span> : null}
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------- Conteúdo

function templateBody(components: unknown) {
  const comps = Array.isArray(components) ? (components as Array<{ type?: string; text?: string }>) : [];
  return comps.find((x) => (x.type ?? "").toUpperCase() === "BODY")?.text ?? "";
}

function ContentTab({
  workspaceId,
  data,
  locked,
  onSave,
  action,
  onRefresh,
}: {
  workspaceId: string;
  data: Detail;
  locked: boolean;
  onSave: (b: Record<string, unknown>) => Promise<void>;
  action: <T = Record<string, unknown>>(b: Record<string, unknown>) => Promise<T>;
  onRefresh: () => void;
}) {
  const c = data.campaign;
  const wantsEmail = c.channel !== "WHATSAPP";
  const wantsWa = c.channel !== "EMAIL";
  const [email, setEmail] = useState<EmailContent>(c.content?.email ?? { subject: c.name, blocks: [] });
  const [dirty, setDirty] = useState(false);
  const [coupon, setCoupon] = useState(c.couponCode ?? "");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [waDraft, setWaDraft] = useState("");
  const [buttonText, setButtonText] = useState("Ver na loja");
  const [imageHeader, setImageHeader] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  useEffect(() => {
    setTestEmail(localStorage.getItem("rel-test-email") ?? data.me.email ?? "");
    setTestPhone(localStorage.getItem("rel-test-phone") ?? "");
  }, [data.me.email]);

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
  const saveContent = async () => {
    await onSave({ content: { email }, couponCode: coupon });
    setDirty(false);
  };
  const selectedTpl = data.templates.find((t) => t.id === c.waTemplateRefId);
  const approved = data.templates.filter((t) => t.status === "APPROVED");
  const testFresh = Boolean(c.testedAt && (!c.contentUpdatedAt || c.testedAt >= c.contentUpdatedAt) && !dirty);

  return (
    <div className="space-y-4">
      {c.status === "APROVADA" || c.status === "AGENDADA" ? (
        <p className="rel-card type-caption text-[var(--ink)]">Editar o conteúdo volta a campanha para Revisão (e desagenda).</p>
      ) : null}
      <section className="rel-card flex flex-wrap items-end gap-3">
        <label>
          <span className="rel-label type-fine-print">Cupom da campanha</span>
          <input
            className="rel-input type-caption w-44 uppercase"
            disabled={locked}
            placeholder="ex.: MAES15"
            value={coupon}
            onChange={(e) => {
              setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""));
              setDirty(true);
            }}
          />
        </label>
        <Button
          variant="outline"
          className="px-4 py-2"
          disabled={locked || busy === "ai"}
          onClick={() =>
            run("ai", async () => {
              if (dirty) await saveContent();
              const r = await action<{ suggestion: { subjects: string[]; email: EmailContent; whatsapp: string } }>({ action: "ai_copy" });
              setSubjects(r.suggestion.subjects);
              if (wantsEmail) {
                setEmail(r.suggestion.email);
                setDirty(true);
              }
              if (wantsWa) setWaDraft(r.suggestion.whatsapp);
              return "Sugestão da IA aplicada como rascunho — revise antes de salvar.";
            })
          }
        >
          {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Sugerir texto com IA (usa o briefing)
        </Button>
        <span className="flex-1" />
        <Button className="px-4 py-2" disabled={locked || !dirty || busy === "save"} onClick={() => run("save", async () => (await saveContent(), "Conteúdo salvo."))}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar conteúdo
        </Button>
      </section>
      {msg ? <p className="rel-card type-caption text-[var(--ink)]">{msg}</p> : null}
      {subjects.length ? (
        <section className="rel-card space-y-2">
          <h3 className="type-caption-strong text-[var(--ink)]">Assuntos sugeridos</h3>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((s) => (
              <OptionChip
                key={s}
                className="px-3 py-1.5"
                selected={email.subject === s}
                onClick={() => {
                  setEmail({ ...email, subject: s });
                  setDirty(true);
                }}
              >
                {s}
              </OptionChip>
            ))}
          </div>
        </section>
      ) : null}

      {wantsEmail ? (
        <EmailBlockEditor
          workspaceId={workspaceId}
          value={email}
          readOnly={locked}
          hasCoupon={Boolean(coupon)}
          onChange={(v) => {
            setEmail(v);
            setDirty(true);
          }}
          preview={(content) => action<{ html: string; bytes: number; clipped: boolean }>({ action: "preview", content })}
        />
      ) : null}

      {wantsWa ? (
        <section className="rel-card space-y-3">
          <h3 className="type-body-strong text-[var(--ink)]">WhatsApp</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <span className="rel-label type-fine-print">Modelo aprovado</span>
                <PillSelect
                  size="field"
                  value={c.waTemplateRefId ?? ""}
                  disabled={locked}
                  onChange={(v) => void onSave({ waTemplateRefId: v })}
                  options={[
                    { value: "", label: "Escolha um modelo" },
                    ...data.templates.map((t) => ({ value: t.id, label: `${t.name} · ${t.status === "APPROVED" ? "aprovado" : t.status.toLowerCase()}` })),
                  ]}
                  aria-label="Modelo"
                />
                {!approved.length ? <p className="type-micro-legal mt-1 text-[var(--ink-muted-48)]">Nenhum modelo aprovado ainda — crie um abaixo.</p> : null}
              </div>
              {!locked ? (
                <div className="space-y-2 border-t border-[var(--divider-soft)] pt-3">
                  <span className="type-caption-strong text-[var(--ink)]">Criar modelo para esta campanha</span>
                  <textarea
                    className="rel-textarea type-caption"
                    rows={5}
                    placeholder="Olá {{first_name}}! ..."
                    value={waDraft}
                    onChange={(e) => setWaDraft(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="rel-input type-caption w-44" maxLength={25} value={buttonText} onChange={(e) => setButtonText(e.target.value)} aria-label="Texto do botão" />
                    <OptionChip className="px-3 py-1.5" selected={imageHeader} onClick={() => setImageHeader((v) => !v)}>
                      Foto no topo
                    </OptionChip>
                    <Button
                      variant="outline"
                      className="px-4 py-2"
                      disabled={!waDraft.trim() || busy === "tpl"}
                      onClick={() =>
                        run("tpl", async () => {
                          await api("/api/atrako/relacionamento/templates", {
                            body: {
                              workspaceId,
                              action: "create_custom",
                              campaignId: c.id,
                              category: "MARKETING",
                              body: waDraft,
                              buttonText,
                              imageHeader,
                              copyCode: Boolean(coupon),
                            },
                          });
                          onRefresh();
                          return "Modelo enviado para aprovação da Meta (minutos a 24 h). Ele já fica ligado à campanha.";
                        })
                      }
                    >
                      Enviar para aprovação
                    </Button>
                  </div>
                  <p className="type-micro-legal text-[var(--ink-muted-48)]">
                    Crie com pelo menos 10 dias de antecedência. Variáveis: {"{{first_name}}"}, {"{{store_name}}"}, {"{{coupon_code}}"}.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="rel-wa-stage">
              {selectedTpl ? (
                <div className="rel-wa-bubble type-caption text-[var(--ink)]">{templateBody(selectedTpl.components)}</div>
              ) : waDraft ? (
                <div className="rel-wa-bubble type-caption text-[var(--ink)]">{waDraft}</div>
              ) : (
                <p className="type-caption text-[var(--ink-muted-48)]">Prévia do WhatsApp aparece aqui.</p>
              )}
              {selectedTpl ? (
                <p className="type-micro-legal mt-2 text-[var(--ink-muted-48)]">Status: {selectedTpl.status}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rel-card flex flex-wrap items-end gap-3">
        {wantsEmail ? (
          <label className="min-w-[200px] flex-1">
            <span className="rel-label type-fine-print">Teste por e-mail</span>
            <input className="rel-input type-caption" inputMode="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          </label>
        ) : null}
        {wantsWa ? (
          <label className="min-w-[200px] flex-1">
            <span className="rel-label type-fine-print">Teste por WhatsApp</span>
            <input className="rel-input type-caption" inputMode="tel" placeholder="11 99999-9999" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          </label>
        ) : null}
        <Button
          variant="outline"
          className="px-4 py-2"
          disabled={busy === "test" || (!testEmail.trim() && !testPhone.trim())}
          onClick={() =>
            run("test", async () => {
              if (dirty) await saveContent();
              if (testEmail) localStorage.setItem("rel-test-email", testEmail);
              if (testPhone) localStorage.setItem("rel-test-phone", testPhone);
              const r = await action<{ result: Record<string, { status?: string; reason?: string }> }>({
                action: "test",
                email: wantsEmail ? testEmail : "",
                phone: wantsWa ? testPhone : "",
              });
              onRefresh();
              return Object.entries(r.result)
                .map(([ch, v]) => `${ch === "email" ? "E-mail" : "WhatsApp"}: ${v.status === "SENT" ? "enviado" : `não enviado (${v.reason ?? v.status})`}`)
                .join(" · ") || "Nada para testar — salve o conteúdo.";
            })
          }
        >
          {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar teste
        </Button>
        {wantsEmail ? (
          <span className="type-fine-print text-[var(--ink-muted-48)]">
            {c.testedAt ? `Último teste ${timeAgo(c.testedAt)}${testFresh ? "" : " (antes da última edição)"}` : "Teste obrigatório antes de aprovar"}
          </span>
        ) : null}
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- Público

function AudienceTab({
  c,
  locked,
  sample,
  onSave,
  action,
}: {
  c: Campaign;
  locked: boolean;
  sample: SampleRow[];
  onSave: (b: Record<string, unknown>) => Promise<void>;
  action: <T = Record<string, unknown>>(b: Record<string, unknown>) => Promise<T>;
}) {
  const [a, setA] = useState<Audience>(c.audience ?? {});
  const [count, setCount] = useState<{ total: number; email: number; whatsapp: number; reachable: number } | null>(null);
  const [rows, setRows] = useState<SampleRow[]>(sample);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sig = JSON.stringify(a);
  useEffect(() => {
    const t = setTimeout(() => {
      action<{ count: { total: number; email: number; whatsapp: number; reachable: number }; sample: SampleRow[] }>({ action: "count", audience: JSON.parse(sig) })
        .then((r) => {
          setCount(r.count);
          setRows(r.sample);
        })
        .catch(() => null);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const set = (p: Partial<Audience>) => {
    setA({ ...a, ...p });
    setDirty(true);
  };
  const lifecycles = a.lifecycles ?? [];
  const reviewed = Boolean(c.checklist?.audienceReviewed) && !dirty;

  return (
    <div className="space-y-4">
      <section className="rel-card space-y-3">
        <div>
          <span className="rel-label type-fine-print">Etapa do cliente</span>
          <div className="flex flex-wrap gap-1.5">
            {LIFECYCLES.map((l) => (
              <OptionChip
                key={l.value}
                className="px-3 py-1.5"
                selected={lifecycles.includes(l.value)}
                onClick={() => !locked && set({ lifecycles: lifecycles.includes(l.value) ? lifecycles.filter((x) => x !== l.value) : [...lifecycles, l.value] })}
              >
                {l.label}
              </OptionChip>
            ))}
          </div>
          <p className="type-micro-legal mt-1 text-[var(--ink-muted-48)]">Nenhuma marcada = toda a base com consentimento.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="rel-label type-fine-print">Gastou pelo menos (R$)</span>
            <input
              className="rel-input type-caption"
              inputMode="numeric"
              disabled={locked}
              value={a.minSpentCents ? String(a.minSpentCents / 100) : ""}
              onChange={(e) => set({ minSpentCents: e.target.value ? Math.round(Number(e.target.value.replace(",", ".")) * 100) || null : null })}
            />
          </label>
          <label>
            <span className="rel-label type-fine-print">Sem comprar há (dias)</span>
            <input
              className="rel-input type-caption"
              inputMode="numeric"
              disabled={locked}
              value={a.inactiveDays ?? ""}
              onChange={(e) => set({ inactiveDays: e.target.value ? Number(e.target.value.replace(/\D/g, "")) || null : null })}
            />
          </label>
          <div>
            <span className="rel-label type-fine-print">Aniversariantes do mês</span>
            <PillSelect
              size="field"
              value={a.birthdayMonth ? String(a.birthdayMonth) : ""}
              disabled={locked}
              onChange={(v) => set({ birthdayMonth: v ? Number(v) : null })}
              options={[{ value: "", label: "Qualquer" }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))]}
              aria-label="Mês de aniversário"
            />
          </div>
        </div>
        <label className="block">
          <span className="rel-label type-fine-print">Comprou produtos que contenham (separe por vírgula)</span>
          <input
            className="rel-input type-caption"
            disabled={locked}
            value={(a.productTitles ?? []).join(", ")}
            onChange={(e) => set({ productTitles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <PillSelect
            value={String(a.excludeRecentDays ?? 0)}
            disabled={locked}
            onChange={(v) => set({ excludeRecentDays: Number(v) || null })}
            options={[
              { value: "0", label: "Não excluir quem recebeu campanha recente" },
              { value: "3", label: "Excluir quem recebeu campanha nos últimos 3 dias" },
              { value: "7", label: "Excluir quem recebeu campanha nos últimos 7 dias" },
              { value: "14", label: "Excluir quem recebeu campanha nos últimos 14 dias" },
            ]}
            aria-label="Excluir recentes"
          />
          <OptionChip className="px-3 py-1.5" selected={Boolean(a.excludeCustomers)} onClick={() => !locked && set({ excludeCustomers: !a.excludeCustomers })}>
            Só quem nunca comprou
          </OptionChip>
        </div>
        <p className="type-micro-legal text-[var(--ink-muted-48)]">
          Sempre fora: descadastrados, bounces, spam, quem saiu do WhatsApp e quem não deu consentimento de marketing.
        </p>
      </section>

      <section className="rel-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="type-tagline tabular-nums text-[var(--ink)]">{count ? num(count.reachable) : "…"}</span>
            <span className="type-caption ml-2 text-[var(--ink-muted-80)]">destinatários alcançáveis</span>
            {count ? (
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                {num(count.total)} no filtro · {num(count.email)} por e-mail · {num(count.whatsapp)} por WhatsApp
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {reviewed ? (
              <span className="rel-badge type-micro-legal" data-tone="ok">
                Público revisado
              </span>
            ) : null}
            <Button
              className="px-4 py-2"
              disabled={locked || saving || (!dirty && reviewed)}
              onClick={async () => {
                setSaving(true);
                setMsg(null);
                try {
                  if (dirty) await onSave({ audience: a });
                  await onSave({ checklist: { audienceReviewed: true } });
                  setDirty(false);
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Erro");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {dirty ? "Salvar e marcar como revisado" : "Marcar como revisado"}
            </Button>
          </div>
        </div>
        {msg ? <p className="type-caption text-[var(--ink)]">{msg}</p> : null}
        {rows.length ? (
          <table className="rel-table type-caption">
            <thead>
              <tr>
                <th>Exemplo de contato</th>
                <th>Etapa</th>
                <th>Gasto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="block text-[var(--ink)]">{r.name || r.email || r.phone}</span>
                    <span className="type-micro-legal text-[var(--ink-muted-48)]">{[r.email, r.phone].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td>{LIFECYCLES.find((l) => l.value === r.profile?.lifecycle)?.label ?? "—"}</td>
                  <td className="tabular-nums">{r.profile ? brl(r.profile.totalSpentCents) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- Revisão

function EstimateBlock({ e, channel }: { e: Estimate; channel: string }) {
  const wa = channel !== "EMAIL";
  const em = channel !== "WHATSAPP";
  return (
    <div className="rel-kpi-grid">
      <div className="rel-kpi">
        <span className="type-fine-print text-[var(--ink-muted-48)]">Destinatários</span>
        <span className="type-tagline tabular-nums text-[var(--ink)]">{num(e.reachable)}</span>
        <span className="type-micro-legal text-[var(--ink-muted-48)]">
          {em ? `${num(e.email)} e-mail` : ""}
          {em && wa ? " · " : ""}
          {wa ? `${num(e.whatsapp)} WhatsApp` : ""}
        </span>
      </div>
      {wa ? (
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Custo estimado WhatsApp</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{brl(e.waCostCents)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            {e.waRateMicros ? `${brlMicros(e.waRateMicros)} por mensagem de marketing` : "Tabela de preço não cadastrada"}
          </span>
        </div>
      ) : null}
      {em ? (
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Tempo de envio (e-mail)</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{e.emailDays <= 1 ? "1 dia" : `${e.emailDays} dias`}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            {e.emailWarmupCap ? `Domínio em aquecimento: ${num(e.emailWarmupCap)}/dia` : "Sem limite de aquecimento"}
          </span>
        </div>
      ) : null}
      {wa ? (
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Tempo de envio (WhatsApp)</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{e.waDays == null ? "Sem capacidade" : e.waDays <= 1 ? "1 dia" : `${e.waDays} dias`}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">
            {e.waCapacity?.limit ? `Limite ${num(e.waCapacity.limit)}/24h · ${num(e.waCapacity.campaignLeft ?? 0)} livres para campanha` : "Limite da conta não informado"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ReviewTab({
  data,
  busy,
  transition,
  onSave,
  onGo,
}: {
  data: Detail;
  busy: string | null;
  transition: (to: string, extra?: Record<string, unknown>, done?: string) => Promise<void>;
  onSave: (b: Record<string, unknown>) => Promise<void>;
  onGo: (t: TabKey) => void;
}) {
  const c = data.campaign;
  const [comment, setComment] = useState("");
  const pending = data.checklist.filter((i) => !i.ok);
  const goFor: Record<string, TabKey> = { email: "conteudo", wa_template: "conteudo", coupon: "conteudo", audience: "publico", test: "conteudo" };
  return (
    <div className="space-y-4">
      <section className="rel-card space-y-2">
        <h3 className="type-body-strong text-[var(--ink)]">Checklist</h3>
        <ul className="space-y-1.5">
          {data.checklist.map((i) => (
            <li key={i.key} className="flex items-start justify-between gap-3">
              <span className="flex items-start gap-2">
                {i.ok ? <Check className="mt-0.5 h-4 w-4 text-[var(--primary)]" /> : <Circle className="mt-1 h-3 w-3 text-[var(--ink-muted-48)]" />}
                <span>
                  <span className="type-caption block text-[var(--ink)]">{i.label}</span>
                  {i.detail ? <span className="type-micro-legal text-[var(--ink-muted-48)]">{i.detail}</span> : null}
                </span>
              </span>
              {!i.ok ? (
                i.key === "coupon" ? (
                  <Button variant="ghost" onClick={() => void onSave({ checklist: { couponConfirmed: true } })}>
                    Confirmar que existe
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => onGo(goFor[i.key] ?? "conteudo")}>
                    Resolver
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <EstimateBlock e={data.estimate} channel={c.channel} />

      {["CRIACAO", "REVISAO", "APROVADA", "AGENDADA"].includes(c.status) ? (
        <section className="rel-card space-y-3">
          <label className="block">
            <span className="rel-label type-fine-print">Comentário (opcional)</span>
            <textarea className="rel-textarea type-caption" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            {["CRIACAO", "REVISAO"].includes(c.status) ? (
              data.canApprove ? (
                <Button
                  className="px-4 py-2"
                  disabled={!!busy || pending.length > 0}
                  title={pending.length ? "Resolva o checklist" : undefined}
                  onClick={() => transition("approve", { comment }, "Campanha aprovada. Agora agende o envio.").then(() => onGo("agendamento"))}
                >
                  Aprovar
                </Button>
              ) : (
                <span className="type-caption text-[var(--ink-muted-80)]">Só Dono ou Admin aprova campanhas.</span>
              )
            ) : null}
            {["REVISAO", "APROVADA", "AGENDADA"].includes(c.status) ? (
              <Button variant="outline" className="px-4 py-2" disabled={!!busy} onClick={() => transition("request_changes", { comment }, "Ajustes solicitados.")}>
                Pedir ajustes
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------------- Agendamento

function ScheduleTab({
  data,
  busy,
  transition,
}: {
  data: Detail;
  busy: string | null;
  transition: (to: string, extra?: Record<string, unknown>, done?: string) => Promise<void>;
}) {
  const c = data.campaign;
  const [at, setAt] = useState(toLocalInput(c.scheduledAt ?? (c.eventDate ? `${c.eventDate.slice(0, 10)}T10:00:00` : null)));
  const [confirm, setConfirm] = useState("");
  if (c.status === "AGENDADA" || c.status === "ENVIANDO" || c.status === "ENVIADA") {
    return (
      <section className="rel-card space-y-2">
        <h3 className="type-body-strong text-[var(--ink)]">
          {c.status === "AGENDADA" ? `Agendada para ${dateBR(c.scheduledAt, true)}` : c.status === "ENVIANDO" ? "Enviando agora" : `Enviada em ${dateBR(c.sentAt, true)}`}
        </h3>
        <p className="type-caption text-[var(--ink-muted-80)]">{c.recipientsCount != null ? `${num(c.recipientsCount)} destinatários` : ""}</p>
        {c.status === "AGENDADA" ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            Para mudar o horário ou o conteúdo, desagende primeiro. Mudanças no conteúdo pedem nova aprovação.
          </p>
        ) : null}
      </section>
    );
  }
  if (c.status !== "APROVADA") {
    return (
      <section className="rel-card">
        <p className="type-caption text-[var(--ink-muted-80)]">A campanha precisa ser aprovada antes de agendar.</p>
      </section>
    );
  }
  return (
    <div className="space-y-4">
      <EstimateBlock e={data.estimate} channel={c.channel} />
      <section className="rel-card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="rel-label type-fine-print">Data e hora do envio</span>
            <input className="rel-input type-caption" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Respeita a janela de envio da loja (horário silencioso).</span>
          </label>
          <label>
            <span className="rel-label type-fine-print">Confirme digitando o total de destinatários ({num(data.estimate.reachable)})</span>
            <input className="rel-input type-caption" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))} />
          </label>
        </div>
        {data.estimate.waDays == null && c.channel !== "EMAIL" ? (
          <p className="type-caption text-[var(--ink)]">Sem capacidade de WhatsApp para campanhas agora — o envio sai em ondas quando o limite liberar.</p>
        ) : null}
        <Button
          className="px-4 py-2"
          disabled={!!busy || !at || Number(confirm) !== data.estimate.reachable}
          onClick={() =>
            transition("schedule", { scheduledAt: new Date(at).toISOString(), confirmCount: Number(confirm) }, `Agendada para ${new Date(at).toLocaleString("pt-BR")}.`)
          }
        >
          Agendar envio
        </Button>
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- Resultados

function ResultsPanel({ results, c }: { results: Results | null; c: Campaign }) {
  if (!results) {
    return (
      <section className="rel-card">
        <p className="type-caption text-[var(--ink-muted-80)]">Os resultados aparecem quando a campanha começar a sair.</p>
      </section>
    );
  }
  const cost = results.byChannel.reduce((s, r) => s + r.costMicros, 0);
  return (
    <div className="space-y-4">
      <div className="rel-kpi-grid">
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Receita atribuída</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{brl(results.attributed.cents)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">{num(results.attributed.orders)} pedidos</span>
        </div>
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Receita influenciada</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{brl(results.influenced.cents)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">{num(results.influenced.orders)} pedidos</span>
        </div>
        <div className="rel-kpi">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Custo</span>
          <span className="type-tagline tabular-nums text-[var(--ink)]">{brlMicros(cost)}</span>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">{c.recipientsCount != null ? `${num(c.recipientsCount)} destinatários` : ""}</span>
        </div>
      </div>
      <section className="rel-card">
        <table className="rel-table type-caption">
          <thead>
            <tr>
              <th>Canal</th>
              <th>Enviados</th>
              <th>Entregues</th>
              <th>Abertos/lidos</th>
              <th>Cliques</th>
              <th>Bounces</th>
            </tr>
          </thead>
          <tbody>
            {results.byChannel.map((r) => (
              <tr key={r.channel}>
                <td>{r.channel === "EMAIL" ? "E-mail" : "WhatsApp"}</td>
                <td className="tabular-nums">{num(r.sent)}</td>
                <td className="tabular-nums">{pct(r.delivered, r.sent)}</td>
                <td className="tabular-nums">{pct(r.opened, r.delivered || r.sent)}</td>
                <td className="tabular-nums">{pct(r.clicked, r.delivered || r.sent)}</td>
                <td className="tabular-nums">{pct(r.bounced, r.sent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- Comentários

const KIND_LABEL: Record<string, string> = { SISTEMA: "Sistema", AJUSTES: "Ajustes pedidos", APROVACAO: "Aprovação", COMENTARIO: "" };

function Comments({ comments, onSend, busy }: { comments: Comment[]; onSend: (body: string) => Promise<void>; busy: boolean }) {
  const [text, setText] = useState("");
  return (
    <aside className="rel-card flex h-fit flex-col gap-3">
      <h3 className="type-body-strong text-[var(--ink)]">Comentários e histórico</h3>
      <ol className="max-h-[520px] space-y-2 overflow-y-auto">
        {comments.map((m) => (
          <li key={m.id} className="space-y-0.5">
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              {m.authorName ?? "Sistema"} · {timeAgo(m.createdAt)}
              {KIND_LABEL[m.kind] ? ` · ${KIND_LABEL[m.kind]}` : ""}
            </p>
            <p className="type-caption whitespace-pre-wrap text-[var(--ink)]">{m.body}</p>
          </li>
        ))}
      </ol>
      <textarea className="rel-textarea type-caption" rows={3} placeholder="Escreva um comentário…" value={text} onChange={(e) => setText(e.target.value)} />
      <Button
        variant="outline"
        className="px-4 py-2"
        disabled={busy || !text.trim()}
        onClick={async () => {
          await onSend(text);
          setText("");
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Comentar
      </Button>
    </aside>
  );
}
