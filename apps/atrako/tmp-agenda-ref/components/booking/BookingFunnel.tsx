"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  getDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { formatBRL, DEFAULT_TIMEZONE, isValidCpf } from "@/lib/utils";
import { enabledFormFields } from "@/lib/funnel-config";
import type { FunnelConfig } from "@/types/funnel-config";
import { FunnelLandingBlocks } from "@/components/booking/FunnelLandingBlocks";
import { BookingWelcomeHero } from "@/components/booking/BookingWelcomeHero";
import { FunnelFormFields } from "@/components/booking/FunnelFormFields";
import { encodeAsaasCardToken } from "@/lib/asaas/client";
import { PixQrImage } from "@/components/payment/PixQrImage";
import { IntakeWizard } from "@/components/intake/IntakeWizard";
import { IntakePriceIncludes } from "@/components/intake/IntakePriceIncludes";
import { PublicTracking } from "@/components/tracking/PublicTracking";
import {
  clickIdsForPayload,
  trackPurchase,
  trackSchedule,
  type PublicTrackingConfig,
} from "@/lib/tracking/client";

type CustomField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string | null;
};

type ProOption = {
  id: string;
  displayName: string;
  photoUrl: string | null;
};

type Service = {
  id: string;
  title: string;
  description: string | null;
  imageUrl?: string | null;
  durationMinutes: number;
  priceCents: number;
  customFields: CustomField[];
  professionals?: ProOption[];
  isIntake?: boolean;
  intakeCheckoutSlug?: string | null;
  intakeProductId?: string | null;
};

type PageInfo = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl?: string | null;
  accentColor: string;
  websiteUrl: string | null;
  instagram: string | null;
  timezone: string;
};

type Slot = { startAt: string; endAt: string; label: string };
type Step =
  | "welcome"
  | "service"
  | "professional"
  | "datetime"
  | "intake"
  | "details"
  | "payment"
  | "done";

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: "service", label: "Servi├ºo" },
  { id: "professional", label: "Profissional" },
  { id: "datetime", label: "Hor├írio" },
  { id: "intake", label: "Formul├írio" },
  { id: "details", label: "Dados" },
  { id: "payment", label: "Pagamento" },
];

function formatCardNumber(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

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
  orgSlug,
  pageSlug,
  resumeToken,
}: {
  orgSlug: string;
  pageSlug: string;
  resumeToken?: string | null;
}) {
  const apiBase = `/api/public/${orgSlug}/${pageSlug}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState<PageInfo | null>(null);
  const [funnelConfig, setFunnelConfig] = useState<FunnelConfig | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [demoPayments, setDemoPayments] = useState(true);
  const [paymentProvider, setPaymentProvider] = useState<
    "CAKTO" | "MERCADO_PAGO" | "ASAAS" | "DEMO"
  >("DEMO");
  const [paymentProviderLabel, setPaymentProviderLabel] = useState("Demo");
  const [caktoSdkClientId, setCaktoSdkClientId] = useState<string | null>(null);
  const [mercadoPagoPublicKey, setMercadoPagoPublicKey] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("welcome");
  const [businessMode, setBusinessMode] = useState<"SOLO" | "SALON">("SOLO");
  const [service, setService] = useState<Service | null>(null);
  const [professional, setProfessional] = useState<ProOption | null>(null);
  const [anyone, setAnyone] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);

  const [details, setDetails] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerCpf: "",
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [holdCountdown, setHoldCountdown] = useState("");
  const [awaitingCardConfirm, setAwaitingCardConfirm] = useState(false);

  const [payMethod, setPayMethod] = useState<"pix" | "card">("pix");
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState({
    holderName: "",
    cardNumber: "",
    cvv: "",
    expMonth: "",
    expYear: "",
  });
  const [installments, setInstallments] = useState(1);
  const [cardMaxInstallments, setCardMaxInstallments] = useState(12);
  const [paying, setPaying] = useState(false);
  const [tracking, setTracking] = useState<PublicTrackingConfig>({
    metaPixelId: null,
    googleAdsSendTo: null,
  });
  const [conversionPaymentId, setConversionPaymentId] = useState<string | null>(
    null,
  );
  const [conversionAmountCents, setConversionAmountCents] = useState<
    number | null
  >(null);
  const [hadOnlinePayment, setHadOnlinePayment] = useState(false);
  const submittingRef = useRef(false);
  const resumeStartedRef = useRef(false);
  const conversionFiredRef = useRef(false);
  const [checkingPix, setCheckingPix] = useState(false);
  const [pixCheckHint, setPixCheckHint] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [showMonthCalendar, setShowMonthCalendar] = useState(false);

  function applyConversionFromStatus(data: {
    paymentId?: string | null;
    amountCents?: number | null;
  }) {
    if (data.paymentId) setConversionPaymentId(data.paymentId);
    if (typeof data.amountCents === "number") {
      setConversionAmountCents(data.amountCents);
    }
    setHadOnlinePayment(true);
  }

  useEffect(() => {
    if (step !== "done" || conversionFiredRef.current) return;
    if (!tracking.metaPixelId && !tracking.googleAdsSendTo) return;
    conversionFiredRef.current = true;
    const user = {
      email: details.customerEmail,
      phone: details.customerPhone,
    };
    void (async () => {
      if (hadOnlinePayment) {
        const eventId =
          (service?.isIntake ? checkoutOrderId : bookingId) ||
          checkoutOrderId ||
          bookingId ||
          `purchase_${Date.now()}`;
        const valueCents =
          conversionAmountCents ?? service?.priceCents ?? 0;
        await trackPurchase({
          eventId,
          valueCents,
          metaPixelId: tracking.metaPixelId,
          googleAdsSendTo: tracking.googleAdsSendTo,
          user,
        });
      } else if (bookingId && tracking.metaPixelId) {
        await trackSchedule({
          eventId: bookingId,
          metaPixelId: tracking.metaPixelId,
          user,
        });
      }
    })();
  }, [
    step,
    tracking.metaPixelId,
    tracking.googleAdsSendTo,
    hadOnlinePayment,
    conversionPaymentId,
    conversionAmountCents,
    checkoutOrderId,
    bookingId,
    service?.priceCents,
    details.customerEmail,
    details.customerPhone,
  ]);

  const accent =
    funnelConfig?.theme.accentColor ||
    (page?.accentColor && page.accentColor !== "#E87722"
      ? page.accentColor
      : "#0a0a0a");

  const formFields = enabledFormFields(funnelConfig);
  const heroTitle = funnelConfig?.theme.heroTitle || page?.title;
  const heroSubtitle = funnelConfig?.theme.heroSubtitle || page?.description;
  const logoUrl = funnelConfig?.theme.logoUrl || page?.logoUrl;

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      /* keep default */
    }
  }, []);

  useEffect(() => {
    fetch(`${apiBase}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("P├ígina n├úo encontrada");
        return r.json();
      })
      .then((data) => {
        setPage(data.page);
        setFunnelConfig(data.funnelConfig || null);
        setServices(data.services);
        setAvailableDays(data.availableDays || []);
        setDemoPayments(data.demoPayments);
        setPaymentProvider(data.paymentProvider || "DEMO");
        setPaymentProviderLabel(data.paymentProviderLabel || "Demo");
        setCaktoSdkClientId(data.caktoSdkClientId);
        setMercadoPagoPublicKey(data.mercadoPagoPublicKey);
        setCardMaxInstallments(
          Math.min(12, Math.max(1, data.cardMaxInstallments || 12)),
        );
        setTracking({
          metaPixelId: data.tracking?.metaPixelId || null,
          googleAdsSendTo: data.tracking?.googleAdsSendTo || null,
        });
        setTimezone(data.page.timezone || DEFAULT_TIMEZONE);
        setBusinessName(data.brand?.businessName || data.page?.businessName || "");
        const mode = data.businessMode === "SALON" ? "SALON" : "SOLO";
        setBusinessMode(mode);

        if (data.availableDays?.[0] && mode === "SOLO") {
          setSelectedDate(data.availableDays[0]);
          setMonth(parseISO(data.availableDays[0]));
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [orgSlug, pageSlug, apiBase]);

  useEffect(() => {
    if (!resumeToken || loading || !page || resumeStartedRef.current) return;
    resumeStartedRef.current = true;

    fetch(`/api/public/manage/${resumeToken}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.error || "Agendamento n├úo encontrado");
        }
        const b = data.booking as {
          id: string;
          status: string;
          startAt: string;
          endAt: string;
          customerName: string;
          customerEmail: string;
          serviceTitle: string;
          serviceId: string;
          durationMinutes: number;
          priceCents: number;
          pageSlug: string;
          holdExpiresAt: string | null;
        };

        if (b.pageSlug !== pageSlug) {
          throw new Error("Este link n├úo corresponde a esta p├ígina de agendamento");
        }

        setBookingId(b.id);
        setManageToken(resumeToken);
        setDetails({
          customerName: b.customerName,
          customerEmail: b.customerEmail || "",
          customerPhone: "",
          customerCpf: "",
        });
        setService({
          id: b.serviceId,
          title: b.serviceTitle,
          description: null,
          durationMinutes: b.durationMinutes,
          priceCents: b.priceCents,
          customFields: [],
        });
        setSelectedSlot({
          startAt: b.startAt,
          endAt: b.endAt,
          label: format(parseISO(b.startAt), "HH:mm"),
        });

        if (b.status === "CONFIRMED") {
          conversionFiredRef.current = true;
          setStep("done");
          return;
        }

        if (b.status !== "PENDING_PAYMENT") {
          throw new Error("Este agendamento n├úo est├í aguardando pagamento");
        }

        if (b.holdExpiresAt && new Date(b.holdExpiresAt) <= new Date()) {
          throw new Error(
            "O prazo para pagamento expirou. Pe├ºa um novo link ├á empresa.",
          );
        }

        setHoldExpiresAt(b.holdExpiresAt);
        setHadOnlinePayment(true);
        setConversionAmountCents(b.priceCents);
        setStep("payment");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Link inv├ílido");
      });
  }, [resumeToken, loading, page, pageSlug]);

  useEffect(() => {
    if (!selectedDate || !service) return;
    if (businessMode === "SALON" && !anyone && !professional) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    const qs = new URLSearchParams({
      date: selectedDate,
      serviceId: service.id,
    });
    if (businessMode === "SALON") {
      if (anyone) qs.set("anyone", "1");
      else if (professional) qs.set("professionalId", professional.id);
    }
    fetch(`${apiBase}?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
        if (data.availableDays) setAvailableDays(data.availableDays);
        setSlotsLoading(false);
      })
      .catch(() => setSlotsLoading(false));
  }, [selectedDate, service, apiBase, businessMode, professional, anyone]);

  // Bootstrap dias dispon├¡veis quando entra no modo profissional
  useEffect(() => {
    if (businessMode !== "SALON" || !service) return;
    if (!anyone && !professional) return;
    if (selectedDate) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const qs = new URLSearchParams({
      date: today,
      serviceId: service.id,
    });
    if (anyone) qs.set("anyone", "1");
    else if (professional) qs.set("professionalId", professional.id);
    fetch(`${apiBase}?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        const days: string[] = data.availableDays || [];
        if (days.length) {
          setAvailableDays(days);
          setSelectedDate(days[0]);
          setMonth(parseISO(days[0]));
        } else {
          setAvailableDays([]);
        }
        setSlots(data.slots || []);
      })
      .catch(() => undefined);
  }, [businessMode, service, professional, anyone, selectedDate, apiBase]);

  const checkoutPayBase = service?.intakeCheckoutSlug
    ? `/api/public/checkout/${service.intakeCheckoutSlug}`
    : null;
  const activePayId = service?.isIntake ? checkoutOrderId : bookingId;

  const startPix = useCallback(
    async (id: string) => {
      setPixLoading(true);
      setError("");
      const res = await fetch(
        service?.isIntake && checkoutPayBase
          ? `${checkoutPayBase}/pay?method=pix`
          : `${apiBase}/pay?method=pix`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            service?.isIntake
              ? { orderId: id, fingerprint: `fp_${id}` }
              : { bookingId: id, fingerprint: `fp_${id}` },
          ),
        },
      );
      const data = await res.json();
      setPixLoading(false);
      if (!res.ok) {
        setError(data.error || "Erro ao gerar Pix");
        return;
      }
      setPixQr(data.qrCode);
      setPixQrBase64(data.qrCodeBase64 || null);
    },
    [apiBase, checkoutPayBase, service?.isIntake],
  );

  // Poll status + auto Pix
  useEffect(() => {
    if (step !== "payment" || !activePayId) return;
    if (payMethod === "pix" && !pixQr && !pixLoading) {
      startPix(activePayId);
    }
  }, [step, activePayId, payMethod, pixQr, pixLoading, startPix]);

  const daySet = useMemo(() => new Set(availableDays), [availableDays]);
  const weekDays = useMemo(() => availableDays.slice(0, 7), [availableDays]);
  const calendarDays = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);
  const padStart = getDay(startOfMonth(month));
  const grouped = useMemo(() => groupSlots(slots), [slots]);

  const welcomeCoverUrl = useMemo(() => {
    if (page?.coverImageUrl) return page.coverImageUrl;
    const imageBlock = funnelConfig?.blocks?.find((b) => b.type === "image");
    if (imageBlock && imageBlock.type === "image" && imageBlock.url) {
      return imageBlock.url;
    }
    return null;
  }, [page?.coverImageUrl, funnelConfig]);

  const visibleSteps = useMemo(() => {
    let steps = STEP_LABELS;
    if (services.length <= 1) {
      steps = steps.filter((s) => s.id !== "service");
    }
    if (businessMode !== "SALON" || service?.isIntake) {
      steps = steps.filter((s) => s.id !== "professional");
    }
    if (service?.isIntake) {
      steps = steps.filter((s) => s.id !== "datetime" && s.id !== "details");
    } else {
      steps = steps.filter((s) => s.id !== "intake");
    }
    if (demoPayments && !service?.isIntake) {
      steps = steps.filter((s) => s.id !== "payment");
    }
    return steps;
  }, [services.length, businessMode, demoPayments, service?.isIntake]);

  const stepIndex = visibleSteps.findIndex((s) => {
    if (step === "done") {
      return s.id === (demoPayments ? "details" : "payment");
    }
    return s.id === step;
  });
  const progressPct =
    step === "done"
      ? 100
      : step === "welcome"
        ? 0
        : Math.round(
            ((Math.max(stepIndex, 0) + 1) / Math.max(visibleSteps.length, 1)) *
              100,
          );

  function goAfterServicePick(s: Service) {
    if (s.isIntake && s.intakeCheckoutSlug) {
      setCheckoutOrderId(null);
      setStep("intake");
      return;
    }
    if (businessMode === "SALON") {
      setStep("professional");
      return;
    }
    setStep("datetime");
    if (!selectedDate && availableDays[0]) {
      setSelectedDate(availableDays[0]);
      setMonth(parseISO(availableDays[0]));
    }
  }

  function startBooking() {
    setError("");
    if (services.length === 1) {
      const s = services[0];
      setService(s);
      setSelectedSlot(null);
      setProfessional(null);
      setAnyone(false);
      goAfterServicePick(s);
      return;
    }
    setStep("service");
  }

  function pickService(s: Service) {
    setService(s);
    setError("");
    setSelectedSlot(null);
    setProfessional(null);
    setAnyone(false);
    goAfterServicePick(s);
  }

  function pickProfessional(p: ProOption | null, asAnyone = false) {
    setAnyone(asAnyone);
    setProfessional(asAnyone ? null : p);
    setError("");
    setSelectedSlot(null);
    setSelectedDate(null);
    setSlots([]);
    setStep("datetime");
  }

  function pickSlot(slot: Slot) {
    setSelectedSlot(slot);
    setError("");
  }

  function confirmSlot() {
    if (!selectedSlot) return;
    setStep("details");
    setError("");
  }

  function selectDate(key: string) {
    setSelectedDate(key);
    setSelectedSlot(null);
    setMonth(parseISO(key));
  }

  async function refreshSlotsForDate(date: string) {
    if (!service) return;
    if (businessMode === "SALON" && !anyone && !professional) return;
    setSlotsLoading(true);
    try {
      const qs = new URLSearchParams({ date, serviceId: service.id });
      if (businessMode === "SALON") {
        if (anyone) qs.set("anyone", "1");
        else if (professional) qs.set("professionalId", professional.id);
      }
      const res = await fetch(`${apiBase}?${qs}`);
      const data = await res.json();
      setSlots(data.slots || []);
      if (data.availableDays) setAvailableDays(data.availableDays);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  function handleSlotUnavailable(message: string) {
    setBookingId(null);
    setManageToken(null);
    setHoldExpiresAt(null);
    setPixQr(null);
    setPixQrBase64(null);
    setAwaitingCardConfirm(false);
    setSelectedSlot(null);
    setStep("datetime");
    setError(message || "Este hor├írio n├úo est├í mais dispon├¡vel. Escolha outro.");
    if (selectedDate) {
      void refreshSlotsForDate(selectedDate);
    }
  }

  useEffect(() => {
    if (!holdExpiresAt || step !== "payment") {
      setHoldCountdown("");
      return;
    }
    const tick = () => {
      const ms = new Date(holdExpiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setHoldCountdown("0:00");
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setHoldCountdown(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt, step]);

  useEffect(() => {
    if (step !== "payment" || !activePayId) return;
    if (payMethod === "pix" && !pixQr) return;
    if (payMethod === "card" && !awaitingCardConfirm) return;

    let cancelled = false;

    async function checkOnce() {
      try {
        const res = await fetch(
          service?.isIntake && checkoutPayBase
            ? `${checkoutPayBase}/status?orderId=${activePayId}`
            : `${apiBase}/status?bookingId=${activePayId}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (cancelled) return;
        if (
          data.status === "CONFIRMED" ||
          data.status === "PAID" ||
          data.paymentStatus === "PAID"
        ) {
          applyConversionFromStatus(data);
          setStep("done");
          setAwaitingCardConfirm(false);
          return;
        }
        if (!service?.isIntake && (data.status === "EXPIRED" || data.status === "CANCELLED")) {
          handleHoldExpired(
            data.status === "EXPIRED"
              ? "O tempo para pagar acabou. Escolha o hor├írio de novo."
              : "Este hor├írio n├úo est├í mais dispon├¡vel. Escolha outro.",
          );
        }
        if (service?.isIntake && data.status === "EXPIRED") {
          setError("O tempo para pagar acabou. Volte ao formul├írio e tente de novo.");
          setCheckoutOrderId(null);
          setStep("intake");
        }
      } catch {
        /* keep polling */
      }
    }

    void checkOnce();
    const id = setInterval(() => void checkOnce(), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [
    step,
    payMethod,
    activePayId,
    pixQr,
    awaitingCardConfirm,
    apiBase,
    checkoutPayBase,
    service?.isIntake,
  ]);

  useEffect(() => {
    if (
      step === "payment" &&
      holdCountdown === "0:00" &&
      holdExpiresAt &&
      new Date(holdExpiresAt).getTime() <= Date.now()
    ) {
      handleHoldExpired(
        "O tempo para pagar acabou. Escolha o hor├írio de novo.",
      );
    }
  }, [holdCountdown, holdExpiresAt, step]);

  function handleHoldExpired(message: string) {
    setBookingId(null);
    setManageToken(null);
    setHoldExpiresAt(null);
    setPixQr(null);
    setPixQrBase64(null);
    setAwaitingCardConfirm(false);
    setSelectedSlot(null);
    setStep("datetime");
    setError(message);
    if (selectedDate) {
      void refreshSlotsForDate(selectedDate);
    }
  }

  async function checkPixNow() {
    const payId = service?.isIntake ? checkoutOrderId : bookingId;
    if (!payId || checkingPix) return;
    setCheckingPix(true);
    setPixCheckHint("Consultando pagamentoÔÇª");
    try {
      const res = await fetch(
        service?.isIntake && checkoutPayBase
          ? `${checkoutPayBase}/status?orderId=${payId}`
          : `${apiBase}/status?bookingId=${payId}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (
        data.status === "CONFIRMED" ||
        data.status === "PAID" ||
        data.paymentStatus === "PAID"
      ) {
        applyConversionFromStatus(data);
        setStep("done");
        setAwaitingCardConfirm(false);
        return;
      }
      if (!service?.isIntake && (data.status === "EXPIRED" || data.status === "CANCELLED")) {
        handleHoldExpired(
          data.status === "EXPIRED"
            ? "O tempo para pagar acabou. Escolha o hor├írio de novo."
            : "Este hor├írio n├úo est├í mais dispon├¡vel. Escolha outro.",
        );
        return;
      }
      setPixCheckHint(
        "Ainda n├úo identificamos o pagamento. Se j├í pagou, aguarde alguns segundos e toque de novo.",
      );
    } catch {
      setPixCheckHint("Falha ao verificar. Tente novamente.");
    } finally {
      setCheckingPix(false);
    }
  }

  async function abandonHold() {
    if (!bookingId) return;
    try {
      await fetch(`${apiBase}/pay?method=abandon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
    } catch {
      /* ignore */
    }
    setBookingId(null);
    setManageToken(null);
    setHoldExpiresAt(null);
    setPixQr(null);
    setPixQrBase64(null);
    setAwaitingCardConfirm(false);
  }

  async function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !selectedSlot || paying || submittingRef.current) return;

    const cpfField = formFields.find((f) => f.preset === "customerCpf" && f.enabled);
    if (cpfField?.required && !isValidCpf(details.customerCpf)) {
      setError("Informe um CPF v├ílido");
      return;
    }
    if (cpfField?.required && !details.customerCpf) {
      setError("Informe o CPF");
      return;
    }

    for (const field of formFields) {
      if (!field.preset && field.required && !answers[field.id]?.trim()) {
        setError(`Preencha: ${field.label}`);
        return;
      }
    }

    setError("");
    submittingRef.current = true;
    setPaying(true);
    try {
      if (bookingId) {
        await abandonHold();
      }

    const customAnswers: Record<string, string> = {};
    for (const field of formFields) {
      if (!field.preset && answers[field.id]?.trim()) {
        customAnswers[field.id] = answers[field.id].trim();
      }
    }

    const payload: Record<string, unknown> = {
      serviceId: service.id,
      startAt: selectedSlot.startAt,
      timezone,
      customerName: details.customerName,
      customAnswers: Object.keys(customAnswers).length ? customAnswers : undefined,
      clickIds: clickIdsForPayload(),
      ...(businessMode === "SALON"
        ? anyone
          ? { anyone: true }
          : professional
            ? { professionalId: professional.id }
            : {}
        : {}),
    };
    for (const field of formFields) {
      if (field.preset === "customerEmail") payload.customerEmail = details.customerEmail;
      if (field.preset === "customerPhone") payload.customerPhone = details.customerPhone.replace(/\D/g, "");
      if (field.preset === "customerCpf" && details.customerCpf) {
        payload.customerCpf = details.customerCpf.replace(/\D/g, "");
      }
    }

    const res = await fetch(`${apiBase}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409 || data.code === "SLOT_UNAVAILABLE") {
        handleSlotUnavailable(data.error);
        return;
      }
      setError(data.error || "N├úo foi poss├¡vel reservar este hor├írio");
      return;
    }
    setBookingId(data.bookingId);
    setManageToken(data.manageToken || null);
    setHoldExpiresAt(data.holdExpiresAt);
    setPixQr(null);
    setPixQrBase64(null);
    setAwaitingCardConfirm(false);
    if (typeof data.amountCents === "number") {
      setConversionAmountCents(data.amountCents);
    }
    if (data.skipPayment || data.status === "CONFIRMED") {
      setHadOnlinePayment(false);
      setStep("done");
      return;
    }
    setHadOnlinePayment(true);
    setStep("payment");
    } finally {
      submittingRef.current = false;
      setPaying(false);
    }
  }

  async function confirmDemoPix() {
    const payId = service?.isIntake ? checkoutOrderId : bookingId;
    if (!payId) return;
    setPaying(true);
    const res = await fetch(
      service?.isIntake && checkoutPayBase
        ? `${checkoutPayBase}/pay?method=demo-confirm`
        : `${apiBase}/pay?method=demo-confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          service?.isIntake ? { orderId: payId } : { bookingId: payId },
        ),
      },
    );
    setPaying(false);
    if (res.ok) {
      setHadOnlinePayment(true);
      setStep("done");
    } else {
      const data = await res.json();
      if (!service?.isIntake && (res.status === 409 || data.code === "SLOT_UNAVAILABLE")) {
        handleSlotUnavailable(data.error);
        return;
      }
      setError(data.error || "Erro");
    }
  }

  async function payCard(e: React.FormEvent) {
    e.preventDefault();
    const payId = service?.isIntake ? checkoutOrderId : bookingId;
    if (!payId) return;
    setPaying(true);
    setError("");

    let cardToken = `demo_${Date.now()}`;
    if (paymentProvider === "ASAAS") {
      const cpf = details.customerCpf.replace(/\D/g, "");
      if (!isValidCpf(cpf)) {
        setPaying(false);
        setError("Informe um CPF v├ílido para pagar com cart├úo");
        return;
      }
      cardToken = encodeAsaasCardToken({
        holderName: card.holderName,
        number: card.cardNumber,
        expiryMonth: card.expMonth,
        expiryYear: card.expYear,
        ccv: card.cvv,
      });
    } else if (
      paymentProvider === "MERCADO_PAGO" &&
      mercadoPagoPublicKey &&
      typeof window !== "undefined"
    ) {
      try {
        if (!window.MercadoPago) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://sdk.mercadopago.com/js/v2";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("SDK Mercado Pago falhou"));
            document.body.appendChild(s);
          });
        }
        const cpf = details.customerCpf.replace(/\D/g, "");
        if (!isValidCpf(cpf)) {
          setPaying(false);
          setError("Informe um CPF v├ílido para pagar com cart├úo");
          return;
        }
        // @ts-expect-error MercadoPago global
        const mp = new window.MercadoPago(mercadoPagoPublicKey);
        const tokenized = await mp.createCardToken({
          cardNumber: card.cardNumber.replace(/\D/g, ""),
          cardholderName: card.holderName,
          cardExpirationMonth: card.expMonth.padStart(2, "0"),
          cardExpirationYear:
            card.expYear.length === 2 ? `20${card.expYear}` : card.expYear,
          securityCode: card.cvv,
          identificationType: "CPF",
          identificationNumber: cpf,
        });
        cardToken = tokenized.id;
      } catch (err) {
        setPaying(false);
        setError(err instanceof Error ? err.message : "Erro ao tokenizar cart├úo");
        return;
      }
    } else if (caktoSdkClientId && typeof window !== "undefined") {
      try {
        // @ts-expect-error Cakto global
        if (!window.Cakto) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cakto-sdk.pages.dev/cakto-sdk.min.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("SDK falhou"));
            document.body.appendChild(s);
          });
        }
        // @ts-expect-error Cakto global
        const sdk = new window.Cakto.CaktoSDK({ client_id: caktoSdkClientId });
        const tokenized = await sdk.createToken({
          holderName: card.holderName,
          cardNumber: card.cardNumber.replace(/\D/g, ""),
          cvv: card.cvv,
          expMonth: card.expMonth.padStart(2, "0"),
          expYear: card.expYear.length === 2 ? card.expYear : card.expYear.slice(-2),
        });
        cardToken = tokenized.cardToken;
      } catch (err) {
        console.warn("Cakto SDK fallback", err);
      }
    }

    const res = await fetch(
      service?.isIntake && checkoutPayBase
        ? `${checkoutPayBase}/pay?method=card`
        : `${apiBase}/pay?method=card`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(service?.isIntake
            ? { orderId: payId }
            : { bookingId: payId }),
          fingerprint: `fp_${payId}`,
          cardToken,
          installments:
            paymentProvider === "MERCADO_PAGO" || paymentProvider === "ASAAS"
              ? Math.min(installments, cardMaxInstallments)
              : 1,
        }),
      },
    );
    const data = await res.json();
    setPaying(false);
    if (!res.ok) {
      if (
        !service?.isIntake &&
        (res.status === 409 || data.code === "SLOT_UNAVAILABLE")
      ) {
        handleSlotUnavailable(data.error);
        return;
      }
      setError(data.error || "Pagamento recusado");
      return;
    }
    if (data.status === "CONFIRMED" || data.status === "PAID") {
      setHadOnlinePayment(true);
      setStep("done");
    } else {
      setAwaitingCardConfirm(true);
      setError("");
      setPixCheckHint(
        "Pagamento em an├ílise. A tela atualiza sozinha ÔÇö ou toque em verificar.",
      );
    }
  }

  function canGoBack() {
    if (step === "service") return true;
    if (step === "professional") return true;
    if (step === "datetime") return true;
    if (step === "intake") return true;
    if (step === "details" || step === "payment") return true;
    return false;
  }

  async function goBack() {
    if (!canGoBack()) return;
    setError("");
    if (step === "service") {
      setStep("welcome");
      setService(null);
      return;
    }
    if (step === "professional") {
      setProfessional(null);
      setAnyone(false);
      if (services.length <= 1) {
        setStep("welcome");
        setService(null);
      } else {
        setStep("service");
        setService(null);
      }
      return;
    }
    if (step === "datetime") {
      setSelectedSlot(null);
      if (businessMode === "SALON") {
        setStep("professional");
        setProfessional(null);
        setAnyone(false);
      } else if (services.length <= 1) {
        setStep("welcome");
        setService(null);
      } else {
        setStep("service");
        setService(null);
      }
      return;
    }
    if (step === "intake") {
      setCheckoutOrderId(null);
      if (services.length <= 1) {
        setStep("welcome");
        setService(null);
      } else {
        setStep("service");
        setService(null);
      }
      return;
    }
    if (step === "details") setStep("datetime");
    else if (step === "payment") {
      if (service?.isIntake) {
        setCheckoutOrderId(null);
        setPixQr(null);
        setStep("intake");
      } else {
        await abandonHold();
        setStep("details");
      }
    }
  }

  if (loading) {
    return (
      <div className="booking-shell flex min-h-dvh items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-transparent"
            style={{
              borderTopColor: accent,
              borderRightColor: accent,
            }}
          />
          <p className="text-sm text-muted">Preparando seu agendamentoÔÇª</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="booking-shell flex min-h-dvh items-center justify-center px-4 text-sm text-danger">
        {error || "P├ígina n├úo encontrada"}
      </div>
    );
  }

  const whenLabel =
    selectedSlot &&
    format(
      toZonedTime(parseISO(selectedSlot.startAt), timezone),
      "EEE, d MMM ┬À HH:mm",
      { locale: ptBR },
    );

  const currentStepLabel =
    step === "done"
      ? "Confirmado"
      : visibleSteps[Math.max(stepIndex, 0)]?.label || "";

  const showDock = step === "datetime" && Boolean(selectedSlot);
  const showBookingProgress = step !== "done" && step !== "welcome";

  const displayName = businessName || heroTitle || "Agendamento";
  const welcomeText = heroSubtitle?.trim() || "";

  return (
    <div
      className={`booking-shell${step === "welcome" ? " booking-shell--welcome" : ""}`}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <PublicTracking config={tracking} />
      {step !== "welcome" && (
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-9 max-w-[7.5rem] object-contain"
            />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
              style={{ background: accent }}
            >
              {(businessName || heroTitle || "BS").slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">
              {heroTitle || displayName}
            </p>
          </div>
          {showBookingProgress && (
            <p className="shrink-0 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted">
              {Math.max(stepIndex, 0) + 1}/{visibleSteps.length}
            </p>
          )}
        </div>
        {showBookingProgress && (
          <div className="mx-auto max-w-lg px-4 pb-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                {currentStepLabel}
              </p>
              {(service || professional || anyone || whenLabel) && (
                <p className="truncate text-[11px] text-muted">
                  {[
                    service?.title,
                    anyone
                      ? "Qualquer dispon├¡vel"
                      : professional?.displayName,
                    whenLabel,
                  ]
                    .filter(Boolean)
                    .join(" ┬À ")}
                </p>
              )}
            </div>
            <div className="booking-progress" aria-hidden>
              <span style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
      </header>
      )}

      <main
        className={
          step === "welcome"
            ? "booking-welcome-main"
            : `mx-auto w-full max-w-lg px-3.5 pb-8 pt-4 sm:px-4 sm:pt-5 ${showDock ? "pb-36" : "pb-10"}`
        }
      >
        {canGoBack() && (
          <button
            type="button"
            onClick={() => void goBack()}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-foreground"
          >
            ÔåÉ Voltar
          </button>
        )}

        {!loading && page && services.length === 0 && step === "welcome" && (
          <div className="booking-card mx-4 mt-5 space-y-2 p-6 text-center sm:mx-0">
            <h1 className="text-lg font-semibold tracking-tight">
              P├ígina em configura├º├úo
            </h1>
            <p className="text-sm text-muted">
              Esta p├ígina ainda n├úo tem servi├ºos dispon├¡veis. Volte em breve ou
              fale com {businessName || "a empresa"}.
            </p>
          </div>
        )}

        {error && step === "welcome" && (
          <p className="mx-4 mb-0 mt-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-danger sm:mx-0">
            {error}
          </p>
        )}

        {error && step !== "welcome" && (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        {step === "welcome" && services.length > 0 && (
          <div className="booking-welcome-stage">
            <BookingWelcomeHero
              coverUrl={welcomeCoverUrl}
              logoUrl={logoUrl ?? null}
              accent={accent}
              title={heroTitle || displayName}
              subtitle={welcomeText}
              ctaLabel="Novo Agendamento"
              onCta={startBooking}
              secondaryCtaLabel="Minhas Reservas"
              onSecondaryCta={() => {
                window.location.href = `/p/${orgSlug}/reservas`;
              }}
            />
            {funnelConfig?.blocks &&
              funnelConfig.blocks.some((b) => b.type !== "image") && (
                <div className="booking-welcome-extras">
                  <FunnelLandingBlocks
                    blocks={funnelConfig.blocks.filter(
                      (b) => b.type !== "image",
                    )}
                  />
                </div>
              )}
          </div>
        )}

        {step === "service" && services.length > 0 && (
          <div className="space-y-4 animate-in">
            <div>
              <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight">
                Escolha o atendimento
              </h1>
              <p className="mt-2 text-sm text-muted">
                Selecione o servi├ºo para ver os hor├írios dispon├¡veis
              </p>
            </div>

            <div className="space-y-3">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickService(s)}
                  className="booking-service group"
                >
                  <div className="flex items-center gap-3">
                    <div className="booking-service-thumb">
                      {s.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.imageUrl} alt="" />
                      ) : (
                        <span aria-hidden>{s.title.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-base font-semibold tracking-tight">
                        {s.title}
                      </p>
                      {s.description && (
                        <p className="mt-0.5 text-sm leading-snug text-muted line-clamp-2">
                          {s.description}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs font-medium text-muted">
                        {s.isIntake
                          ? "Sem agendamento de hor├írio"
                          : `${s.durationMinutes} min`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 self-center">
                      <span
                        className="booking-service-price"
                        style={{ background: accent }}
                      >
                        {formatBRL(s.priceCents)}
                      </span>
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white transition group-hover:scale-105"
                        style={{ background: accent }}
                      >
                        ÔåÆ
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PROFESSIONAL */}
        {step === "intake" && service?.intakeCheckoutSlug && (
          <div className="space-y-4 animate-in">
            <div>
              <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight">
                {service.title}
              </h1>
              <p className="mt-2 text-sm text-muted">
                Preencha o formul├írio e envie os documentos para continuar
              </p>
            </div>
            <div className="booking-card p-4">
              <IntakeWizard
                checkoutSlug={service.intakeCheckoutSlug}
                accentColor={accent}
                onReadyForPayment={async (orderId) => {
                  setCheckoutOrderId(orderId);
                  setHadOnlinePayment(true);
                  setConversionAmountCents(service.priceCents);
                  setHoldExpiresAt(new Date(Date.now() + 15 * 60_000).toISOString());
                  try {
                    const res = await fetch(
                      `/api/public/checkout/${service.intakeCheckoutSlug}/intake?orderId=${orderId}`,
                    );
                    const data = await res.json();
                    if (data.holdExpiresAt) setHoldExpiresAt(data.holdExpiresAt);
                    if (data.data?.partners?.[0]) {
                      setDetails({
                        customerName: data.data.partners[0].fullName || "",
                        customerEmail: data.data.partners[0].email || "",
                        customerPhone: data.data.partners[0].phone || "",
                        customerCpf: data.data.partners[0].cpf || "",
                      });
                    }
                  } catch {
                    /* ignore */
                  }
                  setStep("payment");
                }}
              />
            </div>
          </div>
        )}

        {step === "professional" && service && (
          <div className="space-y-4 animate-in">
            <div>
              <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight">
                Com quem voc├¬ prefere?
              </h1>
              <p className="mt-2 text-sm text-muted">
                {service.title} ┬À escolha o profissional ou qualquer dispon├¡vel
              </p>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => pickProfessional(null, true)}
                className="booking-service group"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ background: accent }}
                  >
                    ?
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-semibold tracking-tight">Qualquer dispon├¡vel</p>
                    <p className="text-sm text-muted">Primeiro hor├írio livre entre a equipe</p>
                  </div>
                  <span className="text-muted">ÔåÆ</span>
                </div>
              </button>
              {(service.professionals || []).map((pro) => (
                <button
                  key={pro.id}
                  type="button"
                  onClick={() => pickProfessional(pro)}
                  className="booking-service group"
                >
                  <div className="flex items-center gap-3">
                    {pro.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pro.photoUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ background: accent }}
                      >
                        {pro.displayName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <p className="min-w-0 flex-1 text-left font-semibold tracking-tight">
                      {pro.displayName}
                    </p>
                    <span className="text-muted">ÔåÆ</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* DATETIME */}
        {step === "datetime" && service && (
          <div className="space-y-5 animate-in">
            <div>
              <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight">
                Escolha o dia e o hor├írio
              </h1>
              {(heroSubtitle || service.description) && (
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {heroSubtitle || service.description}
                </p>
              )}
            </div>

            <div className="booking-selected-service">
              <div className="booking-selected-service-media">
                {service.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={service.imageUrl} alt="" />
                ) : (
                  <span aria-hidden>
                    {service.title.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="booking-selected-service-body">
                <div className="booking-selected-service-top">
                  <div className="min-w-0 flex-1">
                    <p className="booking-selected-service-title">
                      {service.title}
                    </p>
                    {service.description &&
                      service.description !== heroSubtitle && (
                        <p className="booking-selected-service-desc">
                          {service.description}
                        </p>
                      )}
                    {(anyone || professional) && (
                      <p className="booking-selected-service-pro">
                        {anyone
                          ? "Qualquer profissional dispon├¡vel"
                          : professional?.displayName}
                      </p>
                    )}
                  </div>
                  <p
                    className="booking-selected-service-price"
                    style={{ color: accent }}
                  >
                    {formatBRL(service.priceCents)}
                  </p>
                </div>
                <div className="booking-selected-service-meta">
                  <span className="booking-selected-service-duration">
                    {service.durationMinutes} min
                  </span>
                </div>
              </div>
            </div>

            <div className="booking-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <p className="text-sm font-semibold tracking-tight">
                  {showMonthCalendar ? "Calend├írio" : "Pr├│ximos dias"}
                </p>
                <div
                  className="inline-flex rounded-lg bg-muted-bg p-0.5"
                  role="group"
                  aria-label="Visualiza├º├úo do calend├írio"
                >
                  <button
                    type="button"
                    onClick={() => setShowMonthCalendar(false)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      !showMonthCalendar
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMonthCalendar(true)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      showMonthCalendar
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    M├¬s
                  </button>
                </div>
              </div>

              {!showMonthCalendar ? (
                <div className="-mx-0 flex gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {weekDays.length === 0 ? (
                    <p className="text-sm text-muted">Nenhum dia dispon├¡vel.</p>
                  ) : (
                    weekDays.map((key) => {
                      const d = parseISO(key);
                      const selected = selectedDate === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => selectDate(key)}
                          className={`booking-day ${
                            selected ? "booking-day-selected" : ""
                          }`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                            {format(d, "EEE", { locale: ptBR })}
                          </span>
                          <span className="text-lg font-bold leading-none">
                            {format(d, "d")}
                          </span>
                          <span className="text-[10px] font-medium capitalize opacity-80">
                            {format(d, "MMM", { locale: ptBR })}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setMonth(subMonths(month, 1))}
                      className="btn-secondary !px-2.5 !py-1.5"
                      aria-label="M├¬s anterior"
                    >
                      ÔÇ╣
                    </button>
                    <span className="text-sm font-semibold capitalize">
                      {format(month, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMonth(addMonths(month, 1))}
                      className="btn-secondary !px-2.5 !py-1.5"
                      aria-label="Pr├│ximo m├¬s"
                    >
                      ÔÇ║
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                      <span key={`${d}-${i}`} className="py-1">
                        {d}
                      </span>
                    ))}
                    {Array.from({ length: padStart }).map((_, i) => (
                      <span key={`pad-${i}`} />
                    ))}
                    {calendarDays.map((day) => {
                      const key = format(day, "yyyy-MM-dd");
                      const available = daySet.has(key);
                      const selected = selectedDate === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            selectDate(key);
                            setShowMonthCalendar(false);
                          }}
                          className={`aspect-square rounded-xl text-sm font-semibold transition ${
                            !isSameMonth(day, month) ? "opacity-25" : ""
                          } ${
                            selected
                              ? "text-white"
                              : available
                                ? "bg-white ring-1 ring-border hover:bg-muted-bg"
                                : "text-muted/30"
                          }`}
                          style={
                            selected ? { background: accent } : undefined
                          }
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="booking-card p-4">
              {selectedDate ? (
                <>
                  <p className="text-sm font-semibold capitalize tracking-tight">
                    {format(parseISO(selectedDate), "EEEE, d 'de' MMMM", {
                      locale: ptBR,
                    })}
                  </p>
                  {slotsLoading ? (
                    <div className="mt-5 flex items-center justify-center gap-2 py-8 text-sm text-muted">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
                      Carregando hor├íriosÔÇª
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="mt-4 rounded-xl bg-muted-bg px-3 py-5 text-center text-sm text-muted">
                      Sem hor├írios neste dia. Escolha outra data.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-5">
                      {grouped.morning.length > 0 && (
                        <div>
                          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Manh├ú
                          </p>
                          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                            {grouped.morning.map((slot) => (
                              <button
                                key={slot.startAt}
                                type="button"
                                onClick={() => pickSlot(slot)}
                                className={`booking-slot ${
                                  selectedSlot?.startAt === slot.startAt
                                    ? "booking-slot-selected"
                                    : "hover:border-foreground/40"
                                }`}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {grouped.afternoon.length > 0 && (
                        <div>
                          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                            Tarde
                          </p>
                          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                            {grouped.afternoon.map((slot) => (
                              <button
                                key={slot.startAt}
                                type="button"
                                onClick={() => pickSlot(slot)}
                                className={`booking-slot ${
                                  selectedSlot?.startAt === slot.startAt
                                    ? "booking-slot-selected"
                                    : "hover:border-foreground/40"
                                }`}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="py-6 text-center text-sm text-muted">
                  Selecione um dia para ver os hor├írios
                </p>
              )}
            </div>
          </div>
        )}

        {/* DETAILS */}
        {step === "details" && service && (
          <form onSubmit={submitDetails} className="space-y-5 animate-in">
            <div>
              <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight">
                Seus dados
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                Para confirmar e enviar o comprovante
              </p>
            </div>

            {(service || whenLabel) && (
              <div className="booking-summary">
                <div className="min-w-0">
                  <p className="booking-summary-title truncate">{service.title}</p>
                  {whenLabel && (
                    <p className="booking-summary-meta truncate">{whenLabel}</p>
                  )}
                </div>
                <p className="booking-summary-price" style={{ color: accent }}>
                  {formatBRL(service.priceCents)}
                </p>
              </div>
            )}

            <FunnelFormFields
              fields={formFields}
              values={answers}
              onChange={(id, v) => setAnswers({ ...answers, [id]: v })}
              details={details}
              onDetailsChange={(patch) => setDetails({ ...details, ...patch })}
            />

            <button
              type="submit"
              disabled={paying}
              className="btn-primary w-full !rounded-2xl !py-3.5 text-base"
            >
              {paying
                ? "Reservando hor├írioÔÇª"
                : demoPayments
                  ? "Confirmar agendamento"
                  : "Continuar para pagamento"}
            </button>
          </form>
        )}

        {/* PAYMENT */}
        {step === "payment" && service && (
          <div className="space-y-5 animate-in">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight">
                  Pagamento
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Seguro ┬À via {paymentProviderLabel}
                </p>
              </div>
              <p className="text-2xl font-bold tracking-tight" style={{ color: accent }}>
                {formatBRL(service.priceCents)}
              </p>
            </div>

            {service.isIntake && <IntakePriceIncludes />}

            {holdExpiresAt && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">
                  {service.isIntake ? "Pagamento reservado" : "Hor├írio reservado"}
                  {holdCountdown ? ` ┬À ${holdCountdown}` : ""}
                </p>
                <p className="mt-1 text-xs text-amber-900/80">
                  {service.isIntake
                    ? `Conclua at├® ${format(new Date(holdExpiresAt), "HH:mm")} para garantir seu pedido.`
                    : `Conclua at├® ${format(new Date(holdExpiresAt), "HH:mm")} para garantir. Depois disso o hor├írio ├® liberado.`}
                </p>
              </div>
            )}

            {demoPayments && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Modo demo ÔÇö nenhum valor real ser├í cobrado.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {(["pix", "card"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setPayMethod(m);
                    setError("");
                  }}
                  className={`rounded-2xl border px-3 py-3.5 text-sm font-semibold transition ${
                    payMethod === m
                      ? "border-transparent text-white"
                      : "border-border bg-white hover:bg-muted-bg"
                  }`}
                  style={
                    payMethod === m ? { background: accent } : undefined
                  }
                >
                  {m === "pix" ? "Pix" : "Cart├úo"}
                </button>
              ))}
            </div>

            {payMethod === "pix" && (
              <div className="space-y-3">
                {pixLoading && (
                  <div className="booking-card flex items-center justify-center gap-2 py-12 text-sm text-muted">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                    Gerando PixÔÇª
                  </div>
                )}
                {pixQr && (
                  <div className="booking-card space-y-3 p-4">
                    <p className="text-center text-sm font-medium">
                      Escaneie o QR ou copie o c├│digo
                    </p>
                    <PixQrImage payload={pixQr} base64={pixQrBase64} />
                    <textarea
                      readOnly
                      className="h-20 w-full rounded-xl border border-border bg-muted-bg p-2.5 font-mono text-[11px]"
                      value={pixQr}
                    />
                    <button
                      type="button"
                      className="btn-secondary w-full !rounded-2xl !py-3"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(pixQr);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        } catch {
                          setPixCheckHint(
                            "N├úo foi poss├¡vel copiar. Selecione o c├│digo e copie manualmente.",
                          );
                        }
                      }}
                    >
                      {copied ? "C├│digo copiado!" : "Copiar c├│digo Pix"}
                    </button>
                    {demoPayments && (
                      <button
                        type="button"
                        disabled={paying}
                        onClick={confirmDemoPix}
                        className="btn-primary w-full !rounded-2xl !py-3.5"
                      >
                        {paying ? "ConfirmandoÔÇª" : "Simular pagamento (demo)"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={checkingPix}
                      onClick={() => void checkPixNow()}
                      className="btn-primary w-full !rounded-2xl !py-3.5"
                    >
                      {checkingPix
                        ? "VerificandoÔÇª"
                        : "J├í paguei ÔÇö verificar agora"}
                    </button>
                    <p className="text-center text-xs text-muted">
                      {pixCheckHint ||
                        "A tela atualiza sozinha a cada poucos segundos ap├│s o Pix. Se demorar, use o bot├úo acima."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {payMethod === "card" && (
              <form onSubmit={payCard} className="booking-card space-y-3.5 p-4">
                {awaitingCardConfirm && (
                  <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-medium">Pagamento em an├ílise</p>
                    <p className="text-xs text-amber-900/80">
                      {pixCheckHint ||
                        "Aguardando confirma├º├úo do cart├úo. A tela atualiza sozinha."}
                    </p>
                    <button
                      type="button"
                      disabled={checkingPix}
                      onClick={() => void checkPixNow()}
                      className="btn-primary w-full !rounded-2xl !py-3"
                    >
                      {checkingPix
                        ? "VerificandoÔÇª"
                        : "J├í paguei ÔÇö verificar agora"}
                    </button>
                  </div>
                )}
                {(paymentProvider === "MERCADO_PAGO" ||
                  paymentProvider === "ASAAS") &&
                  cardMaxInstallments > 0 &&
                  !awaitingCardConfirm && (
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium">Parcelas</span>
                    <select
                      className="input-field"
                      value={Math.min(installments, cardMaxInstallments)}
                      onChange={(e) =>
                        setInstallments(Number(e.target.value) || 1)
                      }
                    >
                      {Array.from(
                        { length: cardMaxInstallments },
                        (_, i) => i + 1,
                      ).map((n) => (
                        <option key={n} value={n}>
                          {n === 1
                            ? `├Ç vista ÔÇö ${formatBRL(service.priceCents)}`
                            : `${n}x de ${formatBRL(Math.ceil(service.priceCents / n))}`}
                        </option>
                      ))}
                    </select>
                    {cardMaxInstallments === 1 ? (
                      <span className="mt-1 block text-[11px] text-muted">
                        Esta empresa aceita apenas pagamento ├á vista no cart├úo.
                      </span>
                    ) : (
                      <span className="mt-1 block text-[11px] text-muted">
                        At├® {cardMaxInstallments}x. Juros, se houver, seguem a
                        conta {paymentProvider === "ASAAS"
                          ? "Asaas"
                          : "Mercado Pago"}{" "}
                        do vendedor.
                      </span>
                    )}
                  </label>
                )}
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">Nome no cart├úo</span>
                  <input
                    required
                    className="input-field"
                    autoComplete="cc-name"
                    value={card.holderName}
                    onChange={(e) =>
                      setCard({ ...card, holderName: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">N├║mero</span>
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    className="input-field"
                    value={card.cardNumber}
                    onChange={(e) =>
                      setCard({
                        ...card,
                        cardNumber: formatCardNumber(e.target.value),
                      })
                    }
                  />
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium">M├¬s</span>
                    <input
                      required
                      inputMode="numeric"
                      placeholder="MM"
                      maxLength={2}
                      autoComplete="cc-exp-month"
                      className="input-field"
                      value={card.expMonth}
                      onChange={(e) =>
                        setCard({
                          ...card,
                          expMonth: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium">Ano</span>
                    <input
                      required
                      inputMode="numeric"
                      placeholder="AA"
                      maxLength={4}
                      autoComplete="cc-exp-year"
                      className="input-field"
                      value={card.expYear}
                      onChange={(e) =>
                        setCard({
                          ...card,
                          expYear: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium">CVC</span>
                    <input
                      required
                      inputMode="numeric"
                      maxLength={4}
                      autoComplete="cc-csc"
                      className="input-field"
                      value={card.cvv}
                      onChange={(e) =>
                        setCard({
                          ...card,
                          cvv: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={paying || awaitingCardConfirm}
                  className="btn-primary w-full !rounded-2xl !py-3.5 text-base"
                >
                  {paying
                    ? "ProcessandoÔÇª"
                    : awaitingCardConfirm
                      ? "Aguardando confirma├º├úoÔÇª"
                      : `Pagar ${formatBRL(service.priceCents)}`}
                </button>
                <p className="text-center text-[11px] text-muted">
                  Dados do cart├úo tokenizados ┬À n├úo passam pelo nosso servidor
                </p>
              </form>
            )}
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="space-y-5 py-6 text-center animate-in">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl text-white shadow-lg"
              style={{
                background: accent,
                boxShadow: `0 12px 28px color-mix(in srgb, ${accent} 35%, transparent)`,
              }}
            >
              Ô£ô
            </div>
            <div>
              <h1 className="text-[1.75rem] font-bold tracking-tight">
                Agendado!
              </h1>
              {details.customerEmail?.includes("@") ? (
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                  Confirma├º├úo enviada para{" "}
                  <strong className="text-foreground">
                    {details.customerEmail}
                  </strong>
                </p>
              ) : (
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                  Seu hor├írio est├í confirmado. Guarde os detalhes abaixo.
                </p>
              )}
            </div>
            {whenLabel && service && (
              <div className="booking-card mx-auto max-w-sm p-5 text-left text-sm">
                <p className="font-semibold tracking-tight">{service.title}</p>
                <p className="mt-1 capitalize text-muted">{whenLabel}</p>
                <p className="mt-3 text-base font-bold" style={{ color: accent }}>
                  {formatBRL(service.priceCents)}
                </p>
              </div>
            )}
            {manageToken && (
              <a
                href={`/m/${manageToken}`}
                className="inline-flex text-sm font-medium underline-offset-2 hover:underline"
                style={{ color: accent }}
              >
                Remarcar ou ver detalhes
              </a>
            )}
          </div>
        )}
      </main>

      {showDock && selectedSlot && service && (
        <div className="booking-dock fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pt-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {selectedSlot.label}
                <span className="font-normal text-muted">
                  {" "}
                  ┬À{" "}
                  {selectedDate &&
                    format(parseISO(selectedDate), "d MMM", { locale: ptBR })}
                </span>
              </p>
              <p className="truncate text-xs text-muted">
                {service.title} ┬À {formatBRL(service.priceCents)}
              </p>
            </div>
            <button
              type="button"
              onClick={confirmSlot}
              className="btn-primary shrink-0 !rounded-2xl !px-5 !py-3"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}