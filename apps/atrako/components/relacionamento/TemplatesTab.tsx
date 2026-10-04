"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button, OptionChip, PillSelect } from "@/components/ui";
import { api, brlMicros, dateBR, num, pct } from "@/components/relacionamento/format";

type TemplateEvent = { id: string; field: string; event: string | null; detail: string | null; createdAt: string };
type Template = {
  id: string;
  name: string;
  status: string;
  category: string | null;
  requestedCategory: string | null;
  qualityScore: string | null;
  rejectedReason: string | null;
  purpose: string | null;
  purposeLabel: string;
  version: number;
  replacedById: string | null;
  pauseCount: number;
  pausedUntil: string | null;
  lastUsedAt: string | null;
  updatedAt: string;
  components: unknown;
  preview: string;
  events: TemplateEvent[];
  usage: { sent: number; delivered: number; read: number; clicked: number; failed: number; costMicros: number } | null;
};
type TemplatesData = {
  connected: boolean;
  account: Record<string, unknown>;
  subscriptions: { ok: boolean; missing: string[]; reason?: string } | null;
  library: Array<{ purpose: string; label: string; category: string; body: string }>;
  templates: Template[];
};

const STATUS: Record<string, { label: string; tone?: "ok" | "warn" | "bad"; help: string }> = {
  APPROVED: { label: "Aprovado", tone: "ok", help: "Pode ser enviado." },
  PENDING: { label: "Em análise", tone: "warn", help: "A Meta costuma responder em minutos; pode levar até 24 h." },
  IN_APPEAL: { label: "Em recurso", tone: "warn", help: "Recurso aberto no WhatsApp Manager." },
  REJECTED: { label: "Rejeitado", tone: "bad", help: "Crie uma nova versão corrigindo o motivo." },
  PAUSED: { label: "Pausado pela Meta", tone: "bad", help: "Muitos clientes bloquearam/denunciaram. Os passos caem no e-mail até voltar." },
  DISABLED: { label: "Desativado", tone: "bad", help: "Pausado repetidas vezes. Crie uma nova versão com outro texto." },
  LIMIT_EXCEEDED: { label: "Limite de modelos", tone: "bad", help: "A conta atingiu o limite de modelos." },
};

const QUALITY: Record<string, string> = { GREEN: "Alta", YELLOW: "Média", RED: "Baixa", UNKNOWN: "Sem dados ainda" };

function buttonsOf(components: unknown): string[] {
  const comps = Array.isArray(components) ? (components as Array<{ type?: string; buttons?: Array<{ text?: string; type?: string }> }>) : [];
  const b = comps.find((c) => (c.type ?? "").toUpperCase() === "BUTTONS");
  return (b?.buttons ?? []).map((x) => x.text || (x.type === "COPY_CODE" ? "Copiar código" : x.type ?? "Botão"));
}
function hasImageHeader(components: unknown) {
  const comps = Array.isArray(components) ? (components as Array<{ type?: string; format?: string }>) : [];
  return comps.some((c) => (c.type ?? "").toUpperCase() === "HEADER" && (c.format ?? "").toUpperCase() === "IMAGE");
}

const EVENT_FIELD: Record<string, string> = {
  message_template_status_update: "Status",
  message_template_quality_update: "Qualidade",
  template_category_update: "Categoria",
  message_template_components_update: "Conteúdo",
};

function eventLabel(e: TemplateEvent) {
  const head = `${EVENT_FIELD[e.field] ?? e.field}${e.event ? `: ${STATUS[e.event]?.label ?? QUALITY[e.event] ?? e.event}` : ""}`;
  return e.detail ? `${head} — ${String(e.detail)}` : head;
}

function Lint({ workspaceId, category, body, buttons }: { workspaceId: string; category: string; body: string; buttons: Array<{ type: string; text?: string }> }) {
  const [r, setR] = useState<{ errors: string[]; warnings: string[] } | null>(null);
  const sig = JSON.stringify({ category, body, buttons });
  useEffect(() => {
    if (!body.trim()) return setR(null);
    const t = setTimeout(() => {
      api<{ errors: string[]; warnings: string[] }>("/api/atrako/relacionamento/templates", {
        body: { workspaceId, action: "lint", ...(JSON.parse(sig) as object) },
      })
        .then(setR)
        .catch(() => setR(null));
    }, 400);
    return () => clearTimeout(t);
  }, [sig, workspaceId, body]);
  if (!r || (!r.errors.length && !r.warnings.length)) {
    return body.trim() ? <p className="type-fine-print text-[var(--ink-muted-48)]">✓ Sem problemas conhecidos de aprovação.</p> : null;
  }
  return (
    <ul className="space-y-0.5">
      {r.errors.map((e) => (
        <li key={e} className="type-fine-print text-[var(--ink)]">
          ✕ {e}
        </li>
      ))}
      {r.warnings.map((w) => (
        <li key={w} className="type-fine-print text-[var(--ink-muted-80)]">
          ! {w}
        </li>
      ))}
    </ul>
  );
}

export function TemplatesTab({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const [checkSubs, setCheckSubs] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [creating, setCreating] = useState(false);
  const key = ["rel-templates-full", workspaceId, checkSubs];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<TemplatesData>(`/api/atrako/relacionamento/templates?workspaceId=${workspaceId}${checkSubs ? "&subscriptions=1" : ""}`),
  });
  const post = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Record<string, unknown>>("/api/atrako/relacionamento/templates", { body: { workspaceId, ...body } }),
    onSuccess: (r, vars) => {
      if (vars.action === "sync") setMsg(`Sincronizado com a Meta (${num(Number(r.synced ?? 0))} modelos).`);
      else if (vars.action === "ensure_defaults")
        setMsg(
          r.skipped
            ? "Conecte o WhatsApp oficial primeiro."
            : `${num(Number(r.created ?? 0))} modelos enviados para aprovação.${Array.isArray(r.errors) && r.errors.length ? ` Erros: ${(r.errors as string[]).join("; ")}` : ""}`,
        );
      else setMsg("Enviado para aprovação da Meta. A versão anterior segue em uso até a nova ser aprovada.");
      void qc.invalidateQueries({ queryKey: ["rel-templates-full", workspaceId] });
      void qc.invalidateQueries({ queryKey: ["rel-templates", workspaceId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }
  if (!data.connected) {
    return (
      <section className="rel-card space-y-2">
        <h2 className="type-body-strong text-[var(--ink)]">WhatsApp oficial não conectado</h2>
        <p className="type-caption text-[var(--ink-muted-80)]">
          Conecte o número da loja (API oficial da Meta) em Config → Conexões. Sem ele, os passos de WhatsApp enviam o e-mail alternativo.
        </p>
      </section>
    );
  }

  const acc = data.account;
  const visible = data.templates.filter((t) => showOld || !t.replacedById);
  const totalCost = data.templates.reduce((s, t) => s + (t.usage?.costMicros ?? 0), 0);
  const mm = String(acc.marketingMessagesStatus ?? "");

  return (
    <div className="flex flex-col gap-4">
      <section className="rel-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="type-body-strong text-[var(--ink)]">Conta WhatsApp</h2>
            <p className="type-caption text-[var(--ink-muted-80)]">
              Qualidade do número: {QUALITY[String(acc.phoneQuality ?? "UNKNOWN")] ?? String(acc.phoneQuality)} · Limite: {String(acc.messagingLimit ?? "—")} conversas/24h
            </p>
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              Marketing Messages API: {mm === "ONBOARDED" ? "ativa (entrega otimizada de marketing)" : mm ? mm.toLowerCase() : "não ativada — marketing sai pela Cloud API"}
              {" · "}Custo 30 dias: {brlMicros(totalCost)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="px-4 py-2" disabled={post.isPending} onClick={() => post.mutate({ action: "sync" })}>
              Sincronizar com a Meta
            </Button>
            <Button className="px-4 py-2" disabled={post.isPending} onClick={() => post.mutate({ action: "ensure_defaults" })}>
              Criar modelos recomendados
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setCheckSubs(true)}>
            Verificar eventos do webhook
          </Button>
          {data.subscriptions ? (
            <span className="rel-badge type-micro-legal" data-tone={data.subscriptions.ok ? "ok" : "bad"}>
              {data.subscriptions.ok
                ? "Webhook recebe status, qualidade e categoria"
                : data.subscriptions.reason === "meta_app_not_configured"
                  ? "App Meta não configurado em /admin/apps"
                  : `Faltam no app Meta: ${data.subscriptions.missing.join(", ")}`}
            </span>
          ) : null}
        </div>
        {msg ? <p className="type-caption text-[var(--ink)]">{msg}</p> : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <OptionChip className="px-3 py-1.5" selected={showOld} onClick={() => setShowOld((v) => !v)}>
          Mostrar versões antigas
        </OptionChip>
        <Button variant="outline" className="px-4 py-2" onClick={() => setCreating((v) => !v)}>
          Novo modelo
        </Button>
      </div>

      {creating ? <CustomTemplateForm workspaceId={workspaceId} busy={post.isPending} onSubmit={(b) => post.mutate({ action: "create_custom", ...b })} /> : null}

      {visible.length ? (
        visible.map((t) => <TemplateCard key={t.id} workspaceId={workspaceId} t={t} busy={post.isPending} onNewVersion={(b) => post.mutate({ action: "new_version", refId: t.id, ...b })} />)
      ) : (
        <section className="rel-card">
          <p className="type-caption text-[var(--ink-muted-48)]">Nenhum modelo ainda. Clique em “Criar modelos recomendados”.</p>
        </section>
      )}
    </div>
  );
}

function TemplateCard({
  workspaceId,
  t,
  busy,
  onNewVersion,
}: {
  workspaceId: string;
  t: Template;
  busy: boolean;
  onNewVersion: (b: { body: string; category: string }) => void;
}) {
  const [timeline, setTimeline] = useState(false);
  const [editing, setEditing] = useState(false);
  const comps = Array.isArray(t.components) ? (t.components as Array<{ type?: string; text?: string }>) : [];
  const [body, setBody] = useState(comps.find((c) => (c.type ?? "").toUpperCase() === "BODY")?.text ?? "");
  const [category, setCategory] = useState(t.requestedCategory ?? t.category ?? "MARKETING");
  const st = STATUS[t.status] ?? { label: t.status, help: "" };
  const buttons = buttonsOf(t.components);
  const recategorized = t.requestedCategory && t.category && t.requestedCategory !== t.category;

  return (
    <section className="rel-card grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-body-strong text-[var(--ink)]">{t.purposeLabel}</span>
          <span className="rel-badge type-micro-legal" data-tone={st.tone}>
            {st.label}
          </span>
          <span className="rel-badge type-micro-legal">{t.category === "UTILITY" ? "Utilidade" : t.category === "MARKETING" ? "Marketing" : t.category ?? "—"}</span>
          <span className="type-fine-print text-[var(--ink-muted-48)]">
            {t.name} · v{t.version}
            {t.replacedById ? " · substituído" : ""}
          </span>
        </div>
        <p className="type-fine-print text-[var(--ink-muted-80)]">{st.help}</p>
        {t.rejectedReason && t.rejectedReason !== "NONE" ? <p className="type-caption text-[var(--ink)]">Motivo: {t.rejectedReason}</p> : null}
        {recategorized ? (
          <p className="type-caption text-[var(--ink)]">
            A Meta reclassificou de {t.requestedCategory} para {t.category} — o custo por mensagem muda (marketing é ~9× mais caro).
          </p>
        ) : null}
        {t.qualityScore && t.qualityScore !== "UNKNOWN" ? (
          <p className="type-fine-print text-[var(--ink-muted-80)]">Qualidade do modelo: {QUALITY[t.qualityScore] ?? t.qualityScore}</p>
        ) : null}
        {t.pausedUntil ? <p className="type-fine-print text-[var(--ink-muted-80)]">Pausado até {dateBR(t.pausedUntil, true)} ({t.pauseCount}ª pausa)</p> : null}
        {t.usage ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            30 dias: {num(t.usage.sent)} enviados · {pct(t.usage.read, t.usage.delivered || t.usage.sent)} lidos · {num(t.usage.clicked)} cliques ·{" "}
            {num(t.usage.failed)} falhas · {brlMicros(t.usage.costMicros)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="ghost" onClick={() => setTimeline((v) => !v)}>
            {timeline ? "Ocultar histórico" : `Histórico (${t.events.length})`}
          </Button>
          {!t.replacedById ? (
            <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? "Cancelar" : t.status === "REJECTED" || t.status === "DISABLED" ? "Corrigir (nova versão)" : "Editar texto (nova versão)"}
            </Button>
          ) : null}
        </div>
        {timeline ? (
          <ol className="space-y-1 border-l border-[var(--hairline)] pl-3">
            {t.events.length ? (
              t.events.map((e) => (
                <li key={e.id} className="type-fine-print text-[var(--ink-muted-80)]">
                  <span className="tabular-nums text-[var(--ink-muted-48)]">{dateBR(e.createdAt, true)}</span> · {eventLabel(e)}
                </li>
              ))
            ) : (
              <li className="type-fine-print text-[var(--ink-muted-48)]">Sem eventos registrados.</li>
            )}
          </ol>
        ) : null}
        {editing ? (
          <div className="space-y-2 pt-2">
            <PillSelect
              size="field"
              value={category}
              onChange={setCategory}
              options={[
                { value: "UTILITY", label: "Utilidade (transacional, sem promoção)" },
                { value: "MARKETING", label: "Marketing" },
              ]}
              aria-label="Categoria"
            />
            <textarea className="rel-textarea type-caption" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="type-micro-legal text-[var(--ink-muted-48)]">
              Variáveis: {"{{first_name}}"}, {"{{product_name}}"}, {"{{store_name}}"}, {"{{coupon_code}}"}, {"{{order_ref}}"}, {"{{order_total}}"}, {"{{expires}}"}
            </p>
            <Lint workspaceId={workspaceId} category={category} body={body} buttons={buttons.map((text) => ({ type: "URL", text }))} />
            <Button className="px-4 py-2" disabled={busy || !body.trim()} onClick={() => onNewVersion({ body, category })}>
              Enviar nova versão para aprovação
            </Button>
          </div>
        ) : null}
      </div>
      <div className="rel-wa-stage space-y-1.5">
        {hasImageHeader(t.components) ? (
          <div className="rel-wa-bubble type-fine-print text-[var(--ink-muted-48)]" style={{ padding: 24, textAlign: "center" }}>
            [foto do produto]
          </div>
        ) : null}
        <div className="rel-wa-bubble type-caption text-[var(--ink)]">{t.preview || "—"}</div>
        {buttons.map((b) => (
          <div key={b} className="rel-wa-bubble type-caption text-center text-[var(--primary)]">
            {b}
          </div>
        ))}
      </div>
    </section>
  );
}

function CustomTemplateForm({
  workspaceId,
  busy,
  onSubmit,
}: {
  workspaceId: string;
  busy: boolean;
  onSubmit: (b: Record<string, unknown>) => void;
}) {
  const [purpose, setPurpose] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [body, setBody] = useState("Olá {{first_name}}! ");
  const [buttonText, setButtonText] = useState("Ver na loja");
  const [imageHeader, setImageHeader] = useState(false);
  const [copyCode, setCopyCode] = useState(false);
  const buttons = [
    ...(buttonText ? [{ type: "URL", text: buttonText }] : []),
    ...(copyCode ? [{ type: "COPY_CODE" }] : []),
    ...(category === "MARKETING" ? [{ type: "QUICK_REPLY", text: "Parar promoções" }] : []),
  ];
  return (
    <section className="rel-card space-y-3">
      <h3 className="type-body-strong text-[var(--ink)]">Novo modelo</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="rel-label type-fine-print">Identificador (finalidade)</span>
          <input
            className="rel-input type-caption"
            placeholder="ex.: lancamento"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
          />
        </label>
        <div>
          <span className="rel-label type-fine-print">Categoria</span>
          <PillSelect
            size="field"
            value={category}
            onChange={setCategory}
            options={[
              { value: "MARKETING", label: "Marketing" },
              { value: "UTILITY", label: "Utilidade (sem promoção)" },
            ]}
            aria-label="Categoria"
          />
        </div>
      </div>
      <textarea className="rel-textarea type-caption" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="type-micro-legal text-[var(--ink-muted-48)]">
        Variáveis: {"{{first_name}}"}, {"{{product_name}}"}, {"{{store_name}}"}, {"{{coupon_code}}"}, {"{{expires}}"}. Não comece nem termine com variável.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label>
          <span className="rel-label type-fine-print">Texto do botão (link rastreado)</span>
          <input className="rel-input type-caption" maxLength={25} value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
        </label>
        <OptionChip className="px-3 py-1.5" selected={imageHeader} onClick={() => setImageHeader((v) => !v)}>
          Foto do produto no topo
        </OptionChip>
        <OptionChip className="px-3 py-1.5" selected={copyCode} onClick={() => setCopyCode((v) => !v)}>
          Botão copiar cupom
        </OptionChip>
      </div>
      {category === "MARKETING" ? (
        <p className="type-micro-legal text-[var(--ink-muted-48)]">Modelos de marketing ganham o botão “Parar promoções” (exigido para opt-out).</p>
      ) : null}
      <Lint workspaceId={workspaceId} category={category} body={body} buttons={buttons} />
      <Button
        className="px-4 py-2"
        disabled={busy || !body.trim()}
        onClick={() => onSubmit({ purpose: purpose || "personalizado", category, body, buttonText, imageHeader, copyCode })}
      >
        Enviar para aprovação
      </Button>
    </section>
  );
}
