"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brl } from "@/components/agenda/agenda-shared";
import {
  enabledFormFields,
  type FunnelConfig,
  type FormFieldConfig,
} from "@/lib/agenda/funnel-config";

type ProOption = { id: string; displayName: string; photoUrl: string | null };
type CustomField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: unknown;
};

export type BookingFunnelService = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  priceCents: number;
  customFields: CustomField[];
  professionals?: ProOption[];
};

export type BookingFunnelInitial = {
  page: {
    id: string;
    title: string;
    slug: string;
    workspaceSlug: string;
    workspaceName: string;
    description: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    accentColor: string;
    timezone: string;
  };
  funnelConfig: FunnelConfig;
  businessMode: "SOLO" | "SALON";
  services: BookingFunnelService[];
  availableDays: string[];
  onlinePayment: boolean;
};

type Slot = { startAt: string; endAt: string; label: string };

type Step = "service" | "professional" | "date" | "time" | "details" | "payment" | "done";

function groupSlots(slots: Slot[]) {
  const morning: Slot[] = [];
  const afternoon: Slot[] = [];
  for (const s of slots) {
    const h = Number(s.label.split(":")[0]);
    if (h < 12) morning.push(s);
    else afternoon.push(s);
  }
  return { morning, afternoon };
}

export function BookingFunnel({
  workspaceSlug,
  pageSlug,
  initial,
}: {
  workspaceSlug: string;
  pageSlug: string;
  initial: BookingFunnelInitial;
}) {
  const apiBase = `/api/atrako/agenda/public/${workspaceSlug}/${pageSlug}`;
  const salonMode = initial.businessMode === "SALON";
  const formFields = useMemo(
    () => enabledFormFields(initial.funnelConfig),
    [initial.funnelConfig],
  );

  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<BookingFunnelService | null>(null);
  const [professional, setProfessional] = useState<ProOption | null>(null);
  const [anyone, setAnyone] = useState(false);
  const [availableDays, setAvailableDays] = useState(initial.availableDays);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [details, setDetails] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerCpf: "",
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [skipPayment, setSkipPayment] = useState(false);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixB64, setPixB64] = useState<string | null>(null);
  const [payInstructions, setPayInstructions] = useState<string | null>(null);

  const heroTitle = initial.funnelConfig.theme?.heroTitle || initial.page.title;
  const heroSubtitle =
    initial.funnelConfig.theme?.heroSubtitle || initial.page.description;

  const pros = service?.professionals ?? [];
  const showProStep = salonMode && pros.length > 0;

  const loadSlots = useCallback(async () => {
    if (!service || !selectedDate) return;
    setSlotsLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        date: selectedDate,
        serviceId: service.id,
      });
      if (salonMode && !anyone && professional) {
        q.set("professionalId", professional.id);
      }
      if (salonMode && anyone) q.set("anyone", "1");
      const r = await fetch(`${apiBase}/slots?${q}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Falha ao carregar horários");
      setSlots(data.slots || []);
      if (data.availableDays) setAvailableDays(data.availableDays);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [apiBase, service, selectedDate, salonMode, anyone, professional]);

  useEffect(() => {
    if (step === "time") loadSlots();
  }, [step, loadSlots]);

  function fieldValue(preset: FormFieldConfig["preset"]) {
    if (preset === "customerName") return details.customerName;
    if (preset === "customerEmail") return details.customerEmail;
    if (preset === "customerPhone") return details.customerPhone;
    if (preset === "customerCpf") return details.customerCpf;
    return "";
  }

  function setField(preset: FormFieldConfig["preset"], value: string) {
    setDetails((d) => {
      if (preset === "customerName") return { ...d, customerName: value };
      if (preset === "customerEmail") return { ...d, customerEmail: value };
      if (preset === "customerPhone") return { ...d, customerPhone: value };
      if (preset === "customerCpf") return { ...d, customerCpf: value };
      return d;
    });
  }

  function validateDetails() {
    for (const f of formFields) {
      if (f.required && !fieldValue(f.preset)?.trim()) {
        setError(`${f.label} é obrigatório`);
        return false;
      }
    }
    if (service) {
      for (const cf of service.customFields) {
        if (cf.required && !answers[cf.id]?.trim()) {
          setError(`${cf.label} é obrigatório`);
          return false;
        }
      }
    }
    setError("");
    return true;
  }

  async function submitBooking() {
    if (!service || !selectedSlot) return;
    if (!validateDetails()) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch(`${apiBase}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          startAt: selectedSlot.startAt,
          timezone: initial.page.timezone,
          professionalId: anyone ? undefined : professional?.id,
          anyone,
          customerName: details.customerName,
          customerEmail: details.customerEmail,
          customerPhone: details.customerPhone,
          customerCpf: details.customerCpf,
          customAnswers: Object.keys(answers).length ? answers : undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Não foi possível reservar");

      setManageToken(data.manageToken);
      setSkipPayment(Boolean(data.skipPayment));

      if (data.skipPayment) {
        setStep("done");
        return;
      }

      setStep("payment");
      const payRes = await fetch(`${apiBase}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: data.bookingId,
          manageToken: data.manageToken,
        }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || "Falha no pagamento");

      if (payData.status === "CONFIRMED" || payData.status === "PAID") {
        setSkipPayment(true);
        if (payData.instructions) setPayInstructions(payData.instructions);
        setStep("done");
        return;
      }

      setPixQr(payData.qrCode ?? payData.payment?.pixQrCode ?? null);
      setPixB64(payData.qrCodeBase64 ?? payData.payment?.pixQrCodeBase64 ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = useMemo(() => groupSlots(slots), [slots]);

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <header className="border-b border-[var(--hairline)] bg-[var(--canvas)]">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-4">
          {initial.page.logoUrl ? (
            <Image
              src={initial.page.logoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-[var(--radius-xs)] object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="type-caption text-[var(--ink-muted-48)]">
              {initial.page.workspaceName}
            </p>
            <h1 className="type-body-strong truncate text-[var(--ink)]">{heroTitle}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-8">
        {heroSubtitle && step === "service" ? (
          <p className="mb-6 type-body text-[var(--ink-muted-80)]">{heroSubtitle}</p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas-parchment)] px-3 py-2 type-caption text-[var(--ink)]">
            {error}
          </p>
        ) : null}

        {step === "service" && (
          <section className="space-y-3">
            <h2 className="type-display-lg text-[var(--ink)]">Escolha o serviço</h2>
            <ul className="divide-y divide-[var(--divider-soft)] rounded-lg border border-[var(--hairline)] bg-[var(--canvas)]">
              {initial.services.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition active:scale-[0.99]"
                    onClick={() => {
                      setService(s);
                      setProfessional(null);
                      setAnyone(false);
                      setSelectedDate(null);
                      setSelectedSlot(null);
                      setStep(
                        salonMode && (s.professionals?.length ?? 0) > 0
                          ? "professional"
                          : "date",
                      );
                    }}
                  >
                    <span>
                      <span className="type-body-strong text-[var(--ink)]">{s.title}</span>
                      <span className="mt-0.5 block type-caption text-[var(--ink-muted-48)]">
                        {s.durationMinutes} min
                      </span>
                    </span>
                    <span className="type-body-strong tabular-nums text-[var(--primary)]">
                      {brl(s.priceCents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === "professional" && service && (
          <section className="space-y-4">
            <StepBack onBack={() => setStep("service")} />
            <h2 className="type-display-lg text-[var(--ink)]">Profissional</h2>
            <button
              type="button"
              className="utility-card w-full !p-4 text-left transition active:scale-[0.99]"
              onClick={() => {
                setAnyone(true);
                setProfessional(null);
                setStep("date");
              }}
            >
              <span className="type-body-strong text-[var(--ink)]">Qualquer disponível</span>
            </button>
            <ul className="space-y-2">
              {pros.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="utility-card flex w-full items-center gap-3 !p-4 text-left transition active:scale-[0.99]"
                    onClick={() => {
                      setAnyone(false);
                      setProfessional(p);
                      setStep("date");
                    }}
                  >
                    {p.photoUrl ? (
                      <Image
                        src={p.photoUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--canvas-parchment)] type-caption-strong text-[var(--primary)]">
                        {p.displayName.slice(0, 1)}
                      </span>
                    )}
                    <span className="type-body-strong text-[var(--ink)]">{p.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === "date" && service && (
          <section className="space-y-4">
            <StepBack
              onBack={() =>
                setStep(showProStep ? "professional" : "service")
              }
            />
            <h2 className="type-display-lg text-[var(--ink)]">Data</h2>
            <p className="type-caption text-[var(--ink-muted-48)]">{service.title}</p>
            <div className="flex flex-wrap gap-2">
              {availableDays.slice(0, 42).map((d) => {
                const active = selectedDate === d;
                return (
                  <button
                    key={d}
                    type="button"
                    className={
                      active
                        ? "rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-2 type-caption text-[var(--on-primary)]"
                        : "rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2 type-caption text-[var(--ink)]"
                    }
                    onClick={() => {
                      setSelectedDate(d);
                      setSelectedSlot(null);
                      setStep("time");
                    }}
                  >
                    {format(parseISO(d), "EEE d MMM", { locale: ptBR })}
                  </button>
                );
              })}
            </div>
            {availableDays.length === 0 ? (
              <p className="type-caption text-[var(--ink-muted-48)]">
                Nenhum dia disponível no momento.
              </p>
            ) : null}
          </section>
        )}

        {step === "time" && service && selectedDate && (
          <section className="space-y-4">
            <StepBack onBack={() => setStep("date")} />
            <h2 className="type-display-lg text-[var(--ink)]">Horário</h2>
            <p className="type-caption text-[var(--ink-muted-48)]">
              {format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
            {slotsLoading ? (
              <div className="flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : slots.length === 0 ? (
              <p className="type-caption text-[var(--ink-muted-48)]">
                Sem horários neste dia. Escolha outra data.
              </p>
            ) : (
              <SlotGroup
                title="Manhã"
                slots={grouped.morning}
                selected={selectedSlot}
                onSelect={(s) => {
                  setSelectedSlot(s);
                  setStep("details");
                }}
              />
            )}
            {!slotsLoading && grouped.afternoon.length > 0 ? (
              <SlotGroup
                title="Tarde"
                slots={grouped.afternoon}
                selected={selectedSlot}
                onSelect={(s) => {
                  setSelectedSlot(s);
                  setStep("details");
                }}
              />
            ) : null}
          </section>
        )}

        {step === "details" && service && selectedSlot && (
          <section className="space-y-4">
            <StepBack onBack={() => setStep("time")} />
            <h2 className="type-display-lg text-[var(--ink)]">Seus dados</h2>
            <p className="type-caption text-[var(--ink-muted-48)]">
              {service.title} · {selectedSlot.label}
            </p>
            <div className="space-y-3">
              {formFields.map((f) => (
                <label key={f.id} className="block">
                  <span className="type-caption text-[var(--ink-muted-80)]">
                    {f.label}
                    {f.required ? " *" : ""}
                  </span>
                  <input
                    className="mt-1 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2.5 type-body text-[var(--ink)] outline-none focus:border-[var(--primary)]"
                    value={fieldValue(f.preset)}
                    onChange={(e) => setField(f.preset, e.target.value)}
                    type={f.preset === "customerEmail" ? "email" : "text"}
                    autoComplete={
                      f.preset === "customerEmail"
                        ? "email"
                        : f.preset === "customerPhone"
                          ? "tel"
                          : "name"
                    }
                  />
                </label>
              ))}
              {service.customFields.map((cf) => (
                <label key={cf.id} className="block">
                  <span className="type-caption text-[var(--ink-muted-80)]">
                    {cf.label}
                    {cf.required ? " *" : ""}
                  </span>
                  <input
                    className="mt-1 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 py-2.5 type-body text-[var(--ink)]"
                    value={answers[cf.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [cf.id]: e.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <Button
              type="button"
              variant="store-hero"
              className="w-full"
              disabled={submitting}
              onClick={() => submitBooking()}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processando…
                </>
              ) : service.priceCents > 0 && initial.onlinePayment ? (
                `Continuar · ${brl(service.priceCents)}`
              ) : (
                "Confirmar agendamento"
              )}
            </Button>
          </section>
        )}

        {step === "payment" && service && (
          <section className="space-y-4">
            <h2 className="type-display-lg text-[var(--ink)]">Pagamento PIX</h2>
            <p className="type-body text-[var(--ink-muted-80)]">
              {brl(service.priceCents)} · {service.title}
            </p>
            {pixB64 ? (
              <img
                src={`data:image/png;base64,${pixB64}`}
                alt="QR Code PIX"
                className="mx-auto max-w-[220px] rounded-[var(--radius-xs)] border border-[var(--hairline)]"
              />
            ) : null}
            {pixQr ? (
              <div className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas-parchment)] p-3">
                <p className="type-fine-print text-[var(--ink-muted-48)]">Copia e cola</p>
                <p className="mt-1 break-all type-caption text-[var(--ink)]">{pixQr}</p>
              </div>
            ) : (
              <p className="type-caption text-[var(--ink-muted-48)]">
                Gerando PIX… após pagar, você receberá a confirmação por e-mail.
              </p>
            )}
            {manageToken ? (
              <Link
                href={`/b/manage/${manageToken}`}
                className="block text-center type-caption text-[var(--primary)] hover:underline"
              >
                Ver meu agendamento
              </Link>
            ) : null}
          </section>
        )}

        {step === "done" && service && selectedSlot && (
          <section className="space-y-4 text-center">
            <h2 className="type-display-lg text-[var(--ink)]">Agendamento confirmado</h2>
            <p className="type-body text-[var(--ink-muted-80)]">
              {service.title}
              <br />
              {format(parseISO(selectedSlot.startAt), "EEEE, d 'de' MMMM 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
            {payInstructions ? (
              <p className="rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] px-4 py-3 type-caption text-[var(--ink-muted-80)]">
                {payInstructions}
              </p>
            ) : null}
            {manageToken ? (
              <Link
                href={`/b/manage/${manageToken}`}
                className="inline-flex w-full items-center justify-center rounded-[var(--radius-xs)] bg-[var(--primary)] px-7 py-[14px] type-button-large text-[var(--on-primary)] transition active:scale-95"
              >
                Gerenciar reserva
              </Link>
            ) : null}
          </section>
        )}
      </main>
    </div>
  );
}

function StepBack({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      className="type-caption text-[var(--primary)] hover:underline"
      onClick={onBack}
    >
      ← Voltar
    </button>
  );
}

function SlotGroup({
  title,
  slots,
  selected,
  onSelect,
}: {
  title: string;
  slots: Slot[];
  selected: Slot | null;
  onSelect: (s: Slot) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <div>
      <p className="mb-2 type-caption-strong text-[var(--ink-muted-48)]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((s) => (
          <button
            key={s.startAt}
            type="button"
            className={
              selected?.startAt === s.startAt
                ? "rounded-[var(--radius-xs)] bg-[var(--primary)] px-3 py-2 type-caption text-[var(--on-primary)]"
                : "rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-2 type-caption text-[var(--ink)]"
            }
            onClick={() => onSelect(s)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
