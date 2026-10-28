import { captureFirstTouch } from "@/lib/geo-hub/first-touch";

type BrowserWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

function browserWindow(): BrowserWindow | null {
  return typeof window === "undefined" ? null : (window as BrowserWindow);
}

/** Primeira visita + beacon da LP. O pixel só existe no domínio do cliente. */
export function rememberCampaignVisit() {
  const w = browserWindow();
  if (!w) return;
  captureFirstTouch();
  const params = new URLSearchParams(w.location.search);
  const payload = JSON.stringify({
    path: w.location.pathname,
    referrer: document.referrer || "",
    utm_source: params.get("utm_source") || "",
  });
  if (navigator.sendBeacon) navigator.sendBeacon("/api/geo/hit", payload);
  else fetch("/api/geo/hit", { method: "POST", body: payload, keepalive: true }).catch(() => {});
}

function loadPixel(id: string) {
  const w = browserWindow();
  if (!w || w.fbq) return;
  const n = function (...args: unknown[]) {
    const fbq = n as typeof n & { callMethod?: (...a: unknown[]) => void; queue: unknown[][] };
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as BrowserWindow["fbq"] & { queue: unknown[][]; loaded: boolean; version: string; push: typeof n };
  n.queue = [];
  n.loaded = true;
  n.version = "2.0";
  n.push = n;
  w.fbq = n;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  w.fbq("init", id);
  w.fbq("track", "PageView");
}

function loadGa4(id: string) {
  const w = browserWindow();
  if (!w || w.gtag) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
  w.dataLayer = w.dataLayer || [];
  w.gtag = (...args: unknown[]) => {
    w.dataLayer?.push(args);
  };
  w.gtag("js", new Date());
  w.gtag("config", id);
}

/** Pixel e GA4 de Config → Rastreamento. Fora da LP a rota responde 404 e nada é carregado. */
export function loadWorkspaceTracking() {
  if (typeof window === "undefined") return;
  fetch("/api/geo/public-config")
    .then((response) => (response.ok ? response.json() : null))
    .then((config: { pixelId?: string | null; ga4MeasurementId?: string | null } | null) => {
      if (!config) return;
      if (config.pixelId) loadPixel(config.pixelId);
      if (config.ga4MeasurementId) loadGa4(config.ga4MeasurementId);
    })
    .catch(() => {});
}

export function trackFormLead(eventId: string, contentName: string, formSlug: string) {
  const w = browserWindow();
  if (!w) return;
  if (typeof w.fbq === "function") {
    w.fbq("track", "Lead", { content_name: contentName }, { eventID: eventId });
  }
  if (typeof w.gtag === "function") {
    w.gtag("event", "generate_lead", { form_slug: formSlug });
  }
}

export function newLeadEventId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
