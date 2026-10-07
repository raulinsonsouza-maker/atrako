"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BackLink, Button, OptionChip, PillSelect, Switch } from "@/components/ui";
import { EmailBlockEditor } from "@/components/relacionamento/EmailBlockEditor";
import { api, dateBR } from "@/components/relacionamento/format";
import type { EmailContent, WhatsAppContent } from "@/lib/flows/types";
import type { Flow, FlowStore } from "@/components/relacionamento/FlowsTab";
import { flowPhoneItems, type StepPreview } from "@/components/relacionamento/flowPhone";
import { MessagePhone } from "@/components/relacionamento/phone/MessagePhone";
import { WA_EXAMPLE_PARAMS, waPreviewFromComponents } from "@/lib/flows/wa-preview";

export type FlowStep = {
  id: string;
  position: number;
  delayMinutes: number;
  channel: "EMAIL" | "WHATSAPP";
  enabled: boolean;
  content: unknown;
  draftContent: unknown;
  draftUpdatedAt: string | null;
  testedAt: string | null;
  publishedAt: string | null;
  couponCode: string | null;
  couponConfirmed: boolean;
  conditions: Record<string, unknown> | null;
  customized: boolean;
  label: string;
  preview?: StepPreview;
  stats: { sent: number; opened: number; clicked: number; converted: number; cents: number; costMicros: number };
};

type TemplateRow = {
  id: string;
  name: string;
  status: string;
  purpose: string | null;
  purposeLabel: string;
  version: number;
  preview: string;
  components: unknown;
};

const UNITS = [
  { value: "1440", label: "dias" },
  { value: "60", label: "horas" },
  { value: "1", label: "minutos" },
];

function splitDelay(minutes: number): { amount: number; unit: string } {
  if (minutes && minutes % 1440 === 0) return { amount: minutes / 1440, unit: "1440" };
  if (minutes && minutes % 60 === 0) return { amount: minutes / 60, unit: "60" };
  return { amount: minutes, unit: minutes ? "1" : "60" };
}

const TEST_EMAIL_KEY = "rel-test-email";
const TEST_PHONE_KEY = "rel-test-phone";

const RESERVE_STARTER: EmailContent = {
  subject: "{{primeiro_nome}}, temos uma mensagem da {{loja}} para você",
  preheader: "",
  blocks: [
    { type: "heading", text: "Oi, {{primeiro_nome}}!" },
    { type: "text", text: "Tentamos falar com você pelo WhatsApp. Separamos tudo por aqui também." },
    { type: "button", label: "Ver na loja" },
    { type: "signature" },
  ],
};

export function StepEditor({
  workspaceId,
  flow,
  step,
  store,
  focus,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  flow: Flow;
  step: FlowStep;
  store: FlowStore;
  /** Abre já na seção do e-mail reserva (passo de WhatsApp). */
  focus?: "fallback";
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEmail = step.channel === "EMAIL";
  const initial = (step.draftContent ?? step.content) as EmailContent | WhatsAppContent;
  const [email, setEmail] = useState<EmailContent>(() => (isEmail ? (initial as EmailContent) : { subject: "", blocks: [] }));
  const [wa, setWa] = useState<WhatsAppContent>(() => (!isEmail ? (initial as WhatsAppContent) : {}));
  const d = splitDelay(step.delayMinutes);
  const [amount, setAmount] = useState(String(d.amount));
  const [unit, setUnit] = useState(d.unit);
  const [coupon, setCoupon] = useState(step.couponCode ?? "");
  const [couponConfirmed, setCouponConfirmed] = useState(step.couponConfirmed);
  const [enabled, setEnabled] = useState(step.enabled);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [savedDraftAt, setSavedDraftAt] = useState(step.draftUpdatedAt);
  const [testedAt, setTestedAt] = useState(step.testedAt);
  const [hasDraft, setHasDraft] = useState(Boolean(step.draftContent));
  const [reserveTestTo, setReserveTestTo] = useState("");
  const reserveRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setTestTo(localStorage.getItem(isEmail ? TEST_EMAIL_KEY : TEST_PHONE_KEY) ?? "");
    setReserveTestTo(localStorage.getItem(TEST_EMAIL_KEY) ?? "");
  }, [isEmail]);

  useEffect(() => {
    if (focus === "fallback") reserveRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  const templates = useQuery({
    queryKey: ["rel-templates", workspaceId],
    enabled: !isEmail,
    queryFn: () => api<{ templates: TemplateRow[]; connected: boolean }>(`/api/atrako/relacionamento/templates?workspaceId=${workspaceId}`),
  });

  const call = async (action: string, extra: Record<string, unknown> = {}) =>
    api<{ ok?: boolean; deliveryId?: string }>("/api/atrako/relacionamento/flows", { body: { workspaceId, action, stepId: step.id, ...extra } });

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setMsg(null);
    try {
      const m = await fn();
      if (m) setMsg(m);
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };

  const delayMinutes = Math.max(0, Math.round(Number(amount.replace(",", ".")) * Number(unit) || 0));

  const save = () =>
    run("save", async () => {
      await call("step_save", {
        content: dirty ? (isEmail ? email : wa) : undefined,
        delayMinutes,
        enabled,
        couponCode: coupon,
        couponConfirmed,
      });
      if (dirty) {
        setSavedDraftAt(new Date().toISOString());
        setHasDraft(true);
      }
      setDirty(false);
      return dirty ? "Rascunho salvo. Envie um teste e publique." : "Configurações salvas.";
    });

  const test = () =>
    run("test", async () => {
      if (dirty) {
        await call("step_save", { content: isEmail ? email : wa });
        setSavedDraftAt(new Date().toISOString());
        setHasDraft(true);
        setDirty(false);
      }
      localStorage.setItem(isEmail ? TEST_EMAIL_KEY : TEST_PHONE_KEY, testTo);
      await call("step_test", isEmail ? { email: testTo } : { phone: testTo });
      setTestedAt(new Date().toISOString());
      return `Teste enviado para ${testTo}.`;
    });

  const testReserve = () =>
    run("test-reserve", async () => {
      if (dirty) {
        await call("step_save", { content: wa });
        setSavedDraftAt(new Date().toISOString());
        setHasDraft(true);
        setDirty(false);
      }
      localStorage.setItem(TEST_EMAIL_KEY, reserveTestTo);
      await call("step_test", { email: reserveTestTo, reserve: true });
      return `Teste do e-mail reserva enviado para ${reserveTestTo}.`;
    });

  const publish = () =>
    run("publish", async () => {
      await call("step_publish");
      setHasDraft(false);
      return "Publicado. Os próximos envios usam esta versão.";
    });

  const discard = () =>
    run("discard", async () => {
      await call("step_discard");
      const pub = step.content as EmailContent | WhatsAppContent;
      if (isEmail) setEmail(pub as EmailContent);
      else setWa(pub as WhatsAppContent);
      setHasDraft(false);
      setDirty(false);
      return "Rascunho descartado.";
    });

  const reset = () =>
    run("reset", async () => {
      await call("step_reset");
      onClose();
    });

  const testFresh = Boolean(testedAt && savedDraftAt && testedAt >= savedDraftAt && !dirty);
  const all = templates.data?.templates ?? [];
  const approved = all.filter((t) => t.status === "APPROVED");
  const autoTpl = approved.find((t) => t.purpose === wa.purpose);
  const selectedTpl = all.find((t) => t.id === wa.templateRefId) ?? autoTpl;
  const params = useMemo(() => ({ ...WA_EXAMPLE_PARAMS, store_name: store.name }), [store.name]);

  const livePreview: StepPreview | undefined = isEmail
    ? { kind: "email", subject: email.subject, preheader: email.preheader ?? "" }
    : selectedTpl
      ? { kind: "whatsapp", wa: waPreviewFromComponents(selectedTpl.components, params), templateStatus: selectedTpl.status }
      : step.preview;

  const phoneItems = flowPhoneItems(
    workspaceId,
    flow.trigger,
    flow.steps
      .map((s) =>
        s.id === step.id
          ? { ...s, enabled: true, delayMinutes, couponCode: coupon || null, draftContent: isEmail ? email : wa, preview: livePreview }
          : s,
      )
      .sort((a, b) => a.delayMinutes - b.delayMinutes),
    "WHATSAPP",
  );
  const reserveOn = !isEmail && wa.fallbackToEmail !== false;
  const emailPreview = (content: unknown) =>
    api("/api/atrako/relacionamento/flows", { body: { workspaceId, action: "preview", content, couponCode: coupon || null } }) as Promise<{
      html: string;
      bytes: number;
      clipped: boolean;
      problems: string[];
    }>;

  const tplCards = [
    {
      id: "",
      title: "Automático",
      sub: autoTpl ? `Sempre a versão aprovada mais nova (${autoTpl.purposeLabel})` : "Versão aprovada mais nova desta finalidade",
      body: autoTpl ? waPreviewFromComponents(autoTpl.components, params).body : "Nenhum modelo aprovado para esta finalidade ainda.",
    },
    ...approved.map((t) => ({
      id: t.id,
      title: t.purposeLabel,
      sub: `v${t.version} · ${t.name}`,
      body: waPreviewFromComponents(t.components, params).body,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <BackLink onClick={onClose}>Fluxos</BackLink>
          <h2 className="type-tagline mt-1 text-[var(--ink)]">{flow.name}</h2>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            Passo {step.position + 1} · {isEmail ? "E-mail" : "WhatsApp"} ·{" "}
            {hasDraft
              ? `rascunho de ${dateBR(savedDraftAt, true)} — só vai para os clientes depois de publicar`
              : step.publishedAt
                ? `publicado em ${dateBR(step.publishedAt, true)}`
                : "texto padrão"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {step.customized ? (
            <Button variant="ghost" size="toolbar" disabled={!!busy} onClick={reset}>
              Restaurar padrão
            </Button>
          ) : null}
          {hasDraft ? (
            <Button variant="ghost" size="toolbar" disabled={!!busy} onClick={discard}>
              Descartar rascunho
            </Button>
          ) : null}
          <Button variant="outline" size="toolbar" disabled={!!busy} onClick={save}>
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
          <Button
            size="toolbar"
            disabled={!!busy || !hasDraft || dirty || (isEmail && !testFresh)}
            title={isEmail && !testFresh ? "Envie um teste da versão atual antes de publicar" : undefined}
            onClick={publish}
          >
            {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Publicar
          </Button>
        </div>
      </div>

      {msg ? <p className="rel-card type-caption text-[var(--ink)]">{msg}</p> : null}

      <section className="rel-card flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="rel-delay-sentence type-body text-[var(--ink)]">
            <span>Enviar</span>
            <input
              className="rel-input type-caption w-16 text-center"
              inputMode="numeric"
              aria-label="Quanto tempo"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            <PillSelect value={unit} onChange={setUnit} options={UNITS} aria-label="Unidade" />
            <span>depois do gatilho</span>
            {delayMinutes === 0 ? <span className="type-fine-print text-[var(--ink-muted-48)]">(na hora)</span> : null}
          </div>
          <label className="inline-flex items-center gap-2 type-caption text-[var(--ink-muted-80)]">
            {enabled ? "Passo ligado" : "Passo desligado"}
            <Switch checked={enabled} onChange={setEnabled} aria-label="Passo ligado" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--divider-soft)] pt-3">
          <span className="type-caption text-[var(--ink-muted-80)]">Cupom</span>
          <input
            className="rel-input type-caption w-40 uppercase"
            placeholder="opcional, ex.: VOLTA10"
            value={coupon}
            onChange={(e) => {
              setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""));
              setCouponConfirmed(false);
            }}
          />
          {coupon ? (
            <OptionChip className="px-3 py-1.5" selected={couponConfirmed} onClick={() => setCouponConfirmed((v) => !v)}>
              {couponConfirmed ? "✓ " : ""}Já criei este cupom na loja
            </OptionChip>
          ) : (
            <span className="type-fine-print text-[var(--ink-muted-48)]">Sem cupom, blocos de cupom são pulados.</span>
          )}
        </div>
      </section>

      {isEmail ? (
        <EmailBlockEditor
          workspaceId={workspaceId}
          value={email}
          hasCoupon={Boolean(coupon)}
          onChange={(v) => {
            setEmail(v);
            setDirty(true);
          }}
          preview={emailPreview}
        />
      ) : (
        <div className="rel-flow-open mt-0 border-t-0 pt-0">
          <section className="rel-card flex min-w-0 flex-col gap-4">
            <div>
              <h3 className="type-body-strong text-[var(--ink)]">Qual mensagem enviar</h3>
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                O WhatsApp só aceita modelos aprovados pela Meta. Crie ou ajuste em Ajustes › Modelos de WhatsApp.
              </p>
            </div>
            {templates.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-muted-48)]" />
            ) : !templates.data?.connected ? (
              <p className="rel-inset type-caption text-[var(--ink-muted-80)]">
                WhatsApp oficial não conectado. Este passo vai pelo e-mail alternativo.
              </p>
            ) : (
              <div className="rel-tpl-grid">
                {tplCards.map((c) => (
                  <button
                    key={c.id || "auto"}
                    type="button"
                    className="rel-tpl-card"
                    data-selected={(wa.templateRefId ?? "") === c.id}
                    onClick={() => {
                      setWa({ ...wa, templateRefId: c.id || undefined });
                      setDirty(true);
                    }}
                  >
                    <span>
                      <span className="type-caption-strong block text-[var(--ink)]">{c.title}</span>
                      <span className="type-micro-legal block truncate text-[var(--ink-muted-48)]">{c.sub}</span>
                    </span>
                    <span className="rel-tpl-bubble type-fine-print">{c.body}</span>
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center justify-between gap-3 border-t border-[var(--divider-soft)] pt-3 type-caption text-[var(--ink-muted-80)]">
              Se o WhatsApp não puder sair, enviar por e-mail
              <Switch
                checked={wa.fallbackToEmail !== false}
                onChange={(on) => {
                  setWa({ ...wa, fallbackToEmail: on });
                  setDirty(true);
                }}
                aria-label="Enviar e-mail se o WhatsApp falhar"
              />
            </label>
          </section>
          <div className="flex justify-center lg:sticky lg:top-4">
            <MessagePhone storeName={store.name} avatarUrl={store.logoUrl} items={phoneItems} highlightId={step.id} />
          </div>
        </div>
      )}

      {reserveOn ? (
        <section ref={reserveRef} className="flex scroll-mt-4 flex-col gap-3">
          <div className="rel-card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="type-body-strong text-[var(--ink)]">E-mail reserva</h3>
              <p className="type-fine-print text-[var(--ink-muted-48)]">
                Só para quem não recebe este WhatsApp: sem telefone, descadastrado do WhatsApp ou modelo ainda não aprovado. Aparece na aba E-mail do fluxo.
              </p>
            </div>
            {!wa.fallbackEmail ? (
              <Button
                size="toolbar"
                onClick={() => {
                  setWa({ ...wa, fallbackEmail: RESERVE_STARTER });
                  setDirty(true);
                }}
              >
                Criar e-mail reserva
              </Button>
            ) : null}
          </div>
          {wa.fallbackEmail ? (
            <>
              <EmailBlockEditor
                workspaceId={workspaceId}
                value={wa.fallbackEmail}
                hasCoupon={Boolean(coupon)}
                onChange={(v) => {
                  setWa({ ...wa, fallbackEmail: v });
                  setDirty(true);
                }}
                preview={emailPreview}
              />
              <div className="rel-card flex flex-wrap items-end gap-3">
                <label className="min-w-[240px] flex-1">
                  <span className="rel-label type-fine-print">Enviar teste do e-mail reserva para</span>
                  <input
                    className="rel-input type-caption"
                    value={reserveTestTo}
                    inputMode="email"
                    placeholder="voce@loja.com.br"
                    onChange={(e) => setReserveTestTo(e.target.value)}
                  />
                </label>
                <Button variant="outline" className="px-4 py-2" disabled={!!busy || !reserveTestTo.trim()} onClick={testReserve}>
                  {busy === "test-reserve" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Enviar teste
                </Button>
              </div>
            </>
          ) : (
            <p className="rel-inset type-caption text-[var(--ink-muted-80)]">
              Sem e-mail reserva, quem não recebe o WhatsApp não recebe nada neste passo.
            </p>
          )}
        </section>
      ) : null}

      <section className="rel-card flex flex-wrap items-end gap-3">
        <label className="min-w-[240px] flex-1">
          <span className="rel-label type-fine-print">{isEmail ? "Enviar teste para (e-mail)" : "Enviar teste para (WhatsApp com DDD)"}</span>
          <input
            className="rel-input type-caption"
            value={testTo}
            inputMode={isEmail ? "email" : "tel"}
            placeholder={isEmail ? "voce@loja.com.br" : "11 99999-9999"}
            onChange={(e) => setTestTo(e.target.value)}
          />
        </label>
        <Button variant="outline" className="px-4 py-2" disabled={!!busy || !testTo.trim()} onClick={test}>
          {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Enviar teste
        </Button>
        <span className="type-fine-print text-[var(--ink-muted-48)]">
          {testedAt ? `Último teste: ${dateBR(testedAt, true)}${isEmail && hasDraft && !testFresh ? " (antes da última edição)" : ""}` : "Nenhum teste ainda"}
        </span>
      </section>
    </div>
  );
}
