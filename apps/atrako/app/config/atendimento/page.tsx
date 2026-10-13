"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ConfigPage,
  ConfigSection,
  SaveButton,
  useConfigWorkspace,
  useSaveConfig,
  useWorkspaceConfig,
} from "../_components";
import { PillSelect } from "@/components/ui/pill-select";
import { Switch } from "@/components/ui/switch";
import { TextArea, TextField } from "@/components/ui/text-field";
import { parseAttendance, type AttendanceProfile, type HourPreset, type OfferKind } from "@/lib/attendance/profile";

type Offers = {
  whatsappConnected: boolean;
  mercadoPagoConnected: boolean;
  aiConfigured: boolean;
  templateStatus: string | null;
  products: Array<{ id: string; name: string; priceCents: number }>;
  agendaLinks: Array<{ slug: string; label: string; priceCents: number }>;
};

const MODES = [
  { value: "off", label: "Desligado" },
  { value: "qualify", label: "Primeiro atendimento" },
  { value: "sell", label: "Fechar a venda" },
];

const HOURS = [
  { value: "", label: "Sem restrição de horário" },
  { value: "weekdays", label: "Segunda a sexta" },
  { value: "all", label: "Todos os dias" },
  { value: "weekend", label: "Sábado e domingo" },
];

export default function ConfigAtendimentoPage() {
  const { workspaceId } = useConfigWorkspace();
  const { data: config, isLoading } = useWorkspaceConfig();
  const { save, saving, saved, error, markDirty } = useSaveConfig();
  const offers = useQuery({
    queryKey: ["attendance-offers", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config/attendance?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("Não foi possível carregar as ofertas");
      return (await r.json()) as Offers;
    },
    enabled: Boolean(workspaceId),
  });

  const [form, setForm] = useState<AttendanceProfile>(() => parseAttendance(null));

  useEffect(() => {
    if (!config) return;
    setForm(parseAttendance(config.settings.messagingPrefs.attendance));
  }, [config]);

  function edit(patch: Partial<AttendanceProfile>) {
    setForm((current) => parseAttendance({ ...current, ...patch }));
    markDirty();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prefs = { ...(config?.settings.messagingPrefs ?? {}), attendance: form };
    await save({ messagingPrefs: prefs });
  }

  const data = offers.data;
  const offerOptions = [
    { value: "none", label: "Sem link automático" },
    { value: "checkout", label: "Checkout da loja" },
    { value: "agenda", label: "Link da agenda" },
    { value: "fixed", label: "Valor fixo no Mercado Pago" },
  ];
  const templateReady = data?.templateStatus === "APPROVED";

  return (
    <ConfigPage
      title="Atendimento"
      loading={isLoading}
      actions={<SaveButton form="atendimento-form" saving={saving} saved={saved} disabled={isLoading} />}
    >
      <form id="atendimento-form" onSubmit={onSubmit} className="flex flex-col gap-6">
        <ConfigSection
          title="Ficha da empresa"
          description="O agente usa estes fatos no Atrako e no WhatsApp. O que não estiver aqui, ele não inventa."
        >
          <TextArea label="O que a empresa faz" value={form.about} onChange={(v) => edit({ about: v })} rows={3} />
          <TextArea label="O que vende" value={form.sells} onChange={(v) => edit({ sells: v })} rows={3} />
          <TextArea
            label="Condições e preço"
            value={form.conditions}
            onChange={(v) => edit({ conditions: v })}
            rows={3}
            hint="Preço, prazo e o que está incluso. Sem isso, o agente não cita valor."
          />
          <TextField label="Tom de voz" value={form.tone} onChange={(e) => edit({ tone: e.target.value })} />
          <TextArea
            label="Quando passar para uma pessoa"
            value={form.handoffWhen}
            onChange={(v) => edit({ handoffWhen: v })}
            rows={2}
          />
        </ConfigSection>

        <ConfigSection title="Horário" description="Fora deste horário o agente não inicia conversa. Quem já escreveu recebe o horário.">
          <div>
            <p className="type-caption-strong text-[var(--ink)]">Dias</p>
            <PillSelect
              className="mt-2 w-full"
              size="field"
              value={form.hourPreset}
              onChange={(value) => edit({ hourPreset: value as HourPreset | "" })}
              options={HOURS}
              aria-label="Dias de atendimento"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Começa" type="time" value={form.hourStart} onChange={(e) => edit({ hourStart: e.target.value })} />
            <TextField label="Termina" type="time" value={form.hourEnd} onChange={(e) => edit({ hourEnd: e.target.value })} />
          </div>
        </ConfigSection>

        <ConfigSection
          title="Agente no WhatsApp"
          description="O mesmo agente do Atrako. No app ele só lê a ficha. No WhatsApp ele responde, anota e move o card."
        >
          <div>
            <p className="type-caption-strong text-[var(--ink)]">Modo</p>
            <PillSelect
              className="mt-2 w-full"
              size="field"
              value={form.mode}
              onChange={(value) => edit({ mode: value as AttendanceProfile["mode"] })}
              options={MODES}
              aria-label="Modo do agente"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="type-caption-strong text-[var(--ink)]">Responder no WhatsApp oficial</p>
              <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
                {data?.whatsappConnected
                  ? "Usa a conexão já ativa."
                  : "Conecte o WhatsApp em Configurações → Conexões."}
              </p>
            </div>
            <Switch
              checked={form.waEnabled}
              disabled={form.mode === "off" || !data?.whatsappConnected}
              onChange={(waEnabled) => edit({ waEnabled })}
              aria-label="Responder no WhatsApp oficial"
            />
          </div>
          {form.waEnabled && !data?.aiConfigured ? (
            <p className="type-fine-print text-[var(--ink)]">Sem modelo em Configurações → IA, o agente não responde e avisa o admin.</p>
          ) : null}
          {form.waEnabled && data && !templateReady ? (
            <p className="type-fine-print text-[var(--ink)]">
              O primeiro contato usa o modelo sales_welcome.
              {data.templateStatus ? ` Status na Meta: ${data.templateStatus}.` : " Ele ainda não foi criado."} Enquanto não estiver aprovado, essa mensagem não sai.
            </p>
          ) : null}
        </ConfigSection>

        {form.mode === "sell" ? (
          <ConfigSection
            title="Oferta"
            description="O agente envia este link quando a pessoa quer comprar. O card só vai para Ganho quando o pagamento confirma."
          >
            <div>
              <p className="type-caption-strong text-[var(--ink)]">O que enviar</p>
              <PillSelect
                className="mt-2 w-full"
                size="field"
                value={form.offerKind}
                onChange={(value) => edit({ offerKind: value as OfferKind })}
                options={offerOptions}
                aria-label="Oferta"
              />
            </div>
            {form.offerKind === "checkout" ? (
              <div>
                <p className="type-caption-strong text-[var(--ink)]">Checkout</p>
                <PillSelect
                  className="mt-2 w-full"
                  size="field"
                  value={form.checkoutProductId}
                  onChange={(checkoutProductId) => edit({ checkoutProductId })}
                  options={[
                    { value: "", label: data?.products.length ? "Escolha o produto" : "Nenhum checkout publicado" },
                    ...(data?.products ?? []).map((p) => ({
                      value: p.id,
                      label: `${p.name} · ${(p.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
                    })),
                  ]}
                  aria-label="Checkout"
                />
              </div>
            ) : null}
            {form.offerKind === "agenda" ? (
              <div>
                <p className="type-caption-strong text-[var(--ink)]">Link da agenda</p>
                <PillSelect
                  className="mt-2 w-full"
                  size="field"
                  value={form.agendaLinkSlug}
                  onChange={(agendaLinkSlug) => edit({ agendaLinkSlug })}
                  options={[
                    { value: "", label: data?.agendaLinks.length ? "Escolha o link" : "Nenhum link ativo" },
                    ...(data?.agendaLinks ?? []).map((link) => ({ value: link.slug, label: link.label })),
                  ]}
                  aria-label="Link da agenda"
                />
              </div>
            ) : null}
            {form.offerKind === "fixed" ? (
              <TextField
                label="Valor em reais"
                inputMode="decimal"
                value={form.fixedAmount == null ? "" : String(form.fixedAmount)}
                onChange={(e) => edit({ fixedAmount: Number(e.target.value.replace(",", ".")) || null })}
                hint={data?.mercadoPagoConnected ? "Cobra na conexão Mercado Pago." : "Conecte o Mercado Pago para este valor virar link."}
              />
            ) : null}
            <TextField
              label="Nome da oferta"
              value={form.offerLabel}
              onChange={(e) => edit({ offerLabel: e.target.value })}
              placeholder="Como o agente apresenta o link"
            />
          </ConfigSection>
        ) : null}
        {error ? <p className="type-caption text-[var(--ink)]">{error}</p> : null}
      </form>
    </ConfigPage>
  );
}
