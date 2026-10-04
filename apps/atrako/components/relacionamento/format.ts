export function brl(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Custo em micros (1/1.000.000 de real). */
export function brlMicros(micros: number | null | undefined) {
  return ((micros ?? 0) / 1_000_000).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(part: number, total: number) {
  if (!total) return "—";
  return `${((part / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function num(n: number | null | undefined) {
  return (n ?? 0).toLocaleString("pt-BR");
}

export function dateBR(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function delayLabel(minutes: number) {
  if (minutes === 0) return "Na hora";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h`;
  const d = minutes / (60 * 24);
  return Number.isInteger(d) ? `${d} d` : `${Math.round(d)} d`;
}

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  QUEUED: "Na fila",
  SENT: "Enviado",
  DELIVERED: "Entregue",
  OPENED: "Aberto",
  CLICKED: "Clicado",
  CONVERTED: "Comprou",
  BOUNCED: "Bounce",
  COMPLAINED: "Spam",
  FAILED: "Falhou",
  BLOCKED: "Bloqueado",
  SKIPPED: "Pulado",
};

export function deliveryTone(status: string): "ok" | "warn" | "bad" | undefined {
  if (["CONVERTED", "CLICKED", "OPENED", "DELIVERED"].includes(status)) return "ok";
  if (["BOUNCED", "COMPLAINED", "FAILED", "BLOCKED"].includes(status)) return "bad";
  if (["QUEUED", "SENT"].includes(status)) return "warn";
  return undefined;
}

export async function api<T = Record<string, unknown>>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(url, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
  return j;
}
