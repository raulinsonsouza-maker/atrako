"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BackLink, Button, OptionChip, PillSelect } from "@/components/ui";
import { EmailBlockEditor } from "@/components/relacionamento/EmailBlockEditor";
import { api, dateBR } from "@/components/relacionamento/format";
import type { EmailContent, WhatsAppContent } from "@/lib/flows/types";
import type { Flow } from "@/components/relacionamento/FlowsTab";

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
  stats: { sent: number; opened: number; clicked: number; converted: number; cents: number; costMicros: number };
};

type TemplateRow = { id: string; name: string; status: string; purpose: string | null; purposeLabel: string; version: number; preview: string };

const UNITS = [
  { value: "60", label: "horas" },
  { value: "1440", label: "dias" },
  { value: "1", label: "minutos" },
];

function splitDelay(minutes: number): { amount: number; unit: string } {
  if (minutes && minutes % 1440 === 0) return { amount: minutes / 1440, unit: "1440" };
  if (minutes && minutes % 60 === 0) return { amount: minutes / 60, unit: "60" };
  return { amount: minutes, unit: "1" };
}

const TEST_EMAIL_KEY = "rel-test-email";
const TEST_PHONE_KEY = "rel-test-phone";

export function StepEditor({
  workspaceId,
  flow,
  step,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  flow: Flow;
  step: FlowStep;
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

  useEffect(() => {
    setTestTo(localStorage.getItem(isEmail ? TEST_EMAIL_KEY : TEST_PHONE_KEY) ?? "");
  }, [isEmail]);

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

  const save = () =>
    run("save", async () => {
      const delayMinutes = Math.max(0, Math.round(Number(amount.replace(",", ".")) * Number(unit) || 0));
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
  const approved = (templates.data?.templates ?? []).filter((t) => t.status === "APPROVED");
  const selectedTpl = (templates.data?.templates ?? []).find((t) => t.id === wa.templateRefId) ??
    approved.find((t) => t.purpose === wa.purpose);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <BackLink onClick={onClose}>Fluxos</BackLink>
          <h2 className="type-body-strong mt-1 text-[var(--ink)]">
            {flow.name} · passo {step.position + 1} ({isEmail ? "e-mail" : "WhatsApp"})
          </h2>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {step.publishedAt ? `Publicado em ${dateBR(step.publishedAt, true)}` : "Versão padrão"}
            {hasDraft ? ` · rascunho de ${dateBR(savedDraftAt, true)} (não vai para os clientes até publicar)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {step.customized ? (
            <Button variant="ghost" disabled={!!busy} onClick={reset}>
              Restaurar texto padrão
            </Button>
          ) : null}
          {hasDraft ? (
            <Button variant="ghost" disabled={!!busy} onClick={discard}>
              Descartar rascunho
            </Button>
          ) : null}
          <Button variant="outline" className="px-4 py-2" disabled={!!busy} onClick={save}>
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar rascunho
          </Button>
          <Button
            className="px-4 py-2"
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

      <section className="rel-card grid gap-3 sm:grid-cols-[auto_auto_1fr_auto]">
        <div>
          <span className="rel-label type-fine-print">Enviar após</span>
          <div className="flex gap-2">
            <input
              className="rel-input type-caption w-20"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            />
            <PillSelect size="field" value={unit} onChange={setUnit} options={UNITS} aria-label="Unidade" />
          </div>
          <span className="type-micro-legal text-[var(--ink-muted-48)]">depois da entrada no fluxo</span>
        </div>
        <div>
          <span className="rel-label type-fine-print">Cupom fixo do passo</span>
          <input
            className="rel-input type-caption w-40 uppercase"
            placeholder="ex.: VOLTA10"
            value={coupon}
            onChange={(e) => {
              setCoupon(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""));
              setCouponConfirmed(false);
            }}
          />
        </div>
        <div className="flex flex-col justify-end gap-1.5">
          {coupon ? (
            <OptionChip className="px-3 py-1.5" selected={couponConfirmed} onClick={() => setCouponConfirmed((v) => !v)}>
              {couponConfirmed ? "✓ " : ""}Cupom {coupon} já existe na loja
            </OptionChip>
          ) : (
            <span className="type-fine-print text-[var(--ink-muted-48)]">Sem cupom: blocos e passos que exigem cupom são pulados.</span>
          )}
          {coupon && !couponConfirmed ? (
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Crie o cupom na plataforma da loja e confirme — senão o passo fica retido.</span>
          ) : null}
        </div>
        <div className="flex items-end">
          <OptionChip className="px-3 py-1.5" selected={enabled} onClick={() => setEnabled((v) => !v)}>
            {enabled ? "Passo ligado" : "Passo desligado"}
          </OptionChip>
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
          preview={(content) =>
            api("/api/atrako/relacionamento/flows", { body: { workspaceId, action: "preview", content, couponCode: coupon || null } }) as Promise<{
              html: string;
              bytes: number;
              clipped: boolean;
              problems: string[];
            }>
          }
        />
      ) : (
        <section className="rel-card grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <span className="rel-label type-fine-print">Modelo aprovado pela Meta</span>
              {templates.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-muted-48)]" />
              ) : !templates.data?.connected ? (
                <p className="type-caption text-[var(--ink-muted-80)]">WhatsApp oficial não conectado — este passo vai para o e-mail alternativo.</p>
              ) : (
                <PillSelect
                  size="field"
                  value={wa.templateRefId ?? ""}
                  onChange={(v) => {
                    setWa({ ...wa, templateRefId: v || undefined });
                    setDirty(true);
                  }}
                  options={[
                    { value: "", label: `Automático (${wa.purpose ?? "finalidade"}: versão aprovada mais nova)` },
                    ...approved.map((t) => ({ value: t.id, label: `${t.purposeLabel} · v${t.version} · ${t.name}` })),
                  ]}
                  aria-label="Modelo"
                />
              )}
              <p className="type-micro-legal mt-1 text-[var(--ink-muted-48)]">
                Só modelos APROVADOS são enviados. Pausado pela Meta: cai no e-mail. Gerencie em Modelos WhatsApp.
              </p>
            </div>
            <OptionChip
              className="px-3 py-1.5"
              selected={wa.fallbackToEmail !== false}
              onClick={() => {
                setWa({ ...wa, fallbackToEmail: wa.fallbackToEmail === false });
                setDirty(true);
              }}
            >
              {wa.fallbackToEmail !== false ? "✓ " : ""}Se o WhatsApp não puder sair, enviar e-mail
            </OptionChip>
          </div>
          <div className="rel-wa-stage">
            {selectedTpl ? (
              <div className="rel-wa-bubble type-caption text-[var(--ink)]">{selectedTpl.preview}</div>
            ) : (
              <p className="type-caption text-[var(--ink-muted-48)]">Nenhum modelo aprovado para esta finalidade ainda.</p>
            )}
          </div>
        </section>
      )}

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
