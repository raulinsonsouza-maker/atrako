export type AgendaService = {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  priceCents: number;
  active?: boolean;
  sortOrder?: number;
};

export type AgendaBooking = {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  service: string | { id: string; title: string };
  serviceId?: string;
  startAt: string;
  endAt?: string;
  status: string;
  amountCents: number;
  bookingPageId?: string | null;
  professionalId?: string | null;
};

export type AgendaBookingPage = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  active: boolean;
  isDefault?: boolean;
  funnelConfig?: unknown;
  timezone?: string;
};

export type AgendaProfessional = {
  id: string;
  displayName: string;
  phone?: string | null;
  isActive: boolean;
  sortOrder?: number;
};

export type AvailabilityRule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmada",
  PENDING: "Pendente",
  PENDING_PAYMENT: "Aguardando pagamento",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
  NO_SHOW: "Não compareceu",
  EXPIRED: "Expirada",
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function bookingStatusLabel(status: string) {
  return BOOKING_STATUS_LABELS[status] ?? status;
}

export function serviceTitle(service: AgendaBooking["service"]) {
  return typeof service === "string" ? service : service.title;
}

export function agendaApiUrl(
  path: string,
  workspaceId: string,
  search?: Record<string, string | undefined>,
) {
  const q = new URLSearchParams({ workspaceId });
  if (search) {
    for (const [k, v] of Object.entries(search)) {
      if (v != null && v !== "") q.set(k, v);
    }
  }
  const base = path.startsWith("/") ? path : `/api/atrako/agenda/${path}`;
  return `${base}?${q.toString()}`;
}

export function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeek(d: Date) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10);
}
