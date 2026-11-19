import { captureFirstTouch } from "@/lib/geo-hub/first-touch";

type BrowserWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  __atrakoPixelId?: string;
};

export type MetaUserMatch = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
};

export type MetaPageContext = {
  content_name: string;
  content_category: string;
  content_ids: string[];
  content_type: string;
  page_path: string;
};

function browserWindow(): BrowserWindow | null {
  return typeof window === "undefined" ? null : (window as BrowserWindow);
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export function newEventId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** @deprecated use newEventId */
export function newLeadEventId() {
  return newEventId();
}

/** Contexto de conteúdo da LP atual (mentoria / consultoria / genérico). */
export function resolveMetaPageContext(): MetaPageContext {
  const w = browserWindow();
  const path = (w?.location.pathname || "/").replace(/\/+$/, "") || "/";
  const isConsultoria = /\/consultoria(?:\/|$)/i.test(path);
  if (isConsultoria) {
    return {
      content_name: "Consultoria financeira para PME",
      content_category: "consultoria",
      content_ids: ["vilaris-consultoria"],
      content_type: "product",
      page_path: path,
    };
  }
  if (/vilaris/i.test(w?.location.hostname || "") || path === "/" || path === "") {
    return {
      content_name: "Mentoria de carreira Vilaris",
      content_category: "mentoria",
      content_ids: ["vilaris-mentoria"],
      content_type: "product",
      page_path: path || "/",
    };
  }
  return {
    content_name: document.title || "Landing page",
    content_category: "lp",
    content_ids: [path.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "lp"],
    content_type: "product",
    page_path: path || "/",
  };
}

function digitsPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? `55${d}` : d;
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.length > 1 ? parts[parts.length - 1] : "",
  };
}

/** Espelho servidor (CAPI) — mesmo event_id do pixel para dedupe. */
function mirrorCapi(input: {
  eventName: string;
  eventId: string;
  customData?: Record<string, unknown>;
  user?: MetaUserMatch;
}) {
  const w = browserWindow();
  if (!w) return;
  const payload: Record<string, unknown> = {
    event_name: input.eventName,
    event_id: input.eventId,
    event_source_url: w.location.href,
    fbp: readCookie("_fbp") || undefined,
    fbc: readCookie("_fbc") || undefined,
    custom_data: input.customData,
  };
  if (input.user?.email) payload.email = input.user.email;
  if (input.user?.phone) payload.phone = input.user.phone;
  if (input.user?.firstName) payload.first_name = input.user.firstName;
  if (input.user?.lastName) payload.last_name = input.user.lastName;
  if (input.user?.externalId) payload.external_id = input.user.externalId;

  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/geo/capi", blob)) return;
    }
  } catch {
    /* fall through */
  }
  fetch("/api/geo/capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

function trackPixel(
  eventName: string,
  customData: Record<string, unknown> | undefined,
  eventId: string,
  user?: MetaUserMatch,
) {
  const w = browserWindow();
  if (!w || typeof w.fbq !== "function") return;

  const pixelId = w.__atrakoPixelId;
  if (pixelId && user && (user.email || user.phone || user.firstName || user.externalId)) {
    const match: Record<string, string> = { country: "br" };
    if (user.email) match.em = user.email.trim().toLowerCase();
    if (user.phone) {
      const ph = digitsPhone(user.phone);
      if (ph) match.ph = ph;
    }
    if (user.firstName) match.fn = user.firstName.trim().toLowerCase();
    if (user.lastName) match.ln = user.lastName.trim().toLowerCase();
    if (user.externalId) match.external_id = user.externalId;
    w.fbq("init", pixelId, match);
  }

  if (customData && Object.keys(customData).length) {
    w.fbq("track", eventName, customData, { eventID: eventId });
  } else {
    w.fbq("track", eventName, {}, { eventID: eventId });
  }
}

/** Dispara pixel + CAPI com o mesmo event_id. */
export function trackMetaEvent(
  eventName: string,
  customData?: Record<string, unknown>,
  opts?: { eventId?: string; user?: MetaUserMatch },
) {
  const eventId = opts?.eventId || newEventId();
  trackPixel(eventName, customData, eventId, opts?.user);
  mirrorCapi({ eventName, eventId, customData, user: opts?.user });
  return eventId;
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

function fireLandingEvents() {
  const ctx = resolveMetaPageContext();
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const utm: Record<string, string> = {};
  if (params) {
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"] as const) {
      const v = params.get(key)?.trim();
      if (v) utm[key] = v.slice(0, 120);
    }
  }

  const pageCustom = {
    content_name: ctx.content_name,
    content_category: ctx.content_category,
    content_ids: ctx.content_ids,
    content_type: ctx.content_type,
    page_path: ctx.page_path,
    ...utm,
  };

  trackMetaEvent("PageView", pageCustom);

  trackMetaEvent("ViewContent", {
    ...pageCustom,
    currency: "BRL",
  });
}

function loadPixel(id: string) {
  const w = browserWindow();
  if (!w) return;
  w.__atrakoPixelId = id;
  if (!w.fbq) {
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
  }
  w.fbq!("init", id);
  fireLandingEvents();
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

export function trackFormLead(
  eventId: string,
  contentName: string,
  formSlug: string,
  opts?: { user?: MetaUserMatch; fullName?: string; company?: string },
) {
  const w = browserWindow();
  if (!w) return;
  const ctx = resolveMetaPageContext();
  let user = opts?.user;
  if (!user && opts?.fullName) {
    const parts = splitName(opts.fullName);
    user = { ...opts.user, firstName: parts.firstName, lastName: parts.lastName };
  }
  const custom: Record<string, unknown> = {
    content_name: contentName,
    content_category: ctx.content_category,
    content_ids: ctx.content_ids,
    content_type: "lead",
    form_slug: formSlug,
    page_path: ctx.page_path,
    currency: "BRL",
    status: true,
  };
  if (opts?.company) custom.company = opts.company.slice(0, 120);

  trackPixel("Lead", custom, eventId, user);
  mirrorCapi({ eventName: "Lead", eventId, customData: custom, user });

  if (typeof w.gtag === "function") {
    w.gtag("event", "generate_lead", { form_slug: formSlug, content_name: contentName });
  }
}

/** Clique em CTA (Conversar, Quero organizar…) → Contact no pixel + CAPI. */
export function trackContactClick(label: string) {
  const ctx = resolveMetaPageContext();
  trackMetaEvent("Contact", {
    content_name: label.slice(0, 120),
    content_category: ctx.content_category,
    content_ids: ctx.content_ids,
    content_type: "cta",
    page_path: ctx.page_path,
  });
}

/** Liga cliques em CTAs (`#conversa`, header, `[data-meta-event="Contact"]`) — não no submit do form. */
export function bindMetaCtaTracking(root: ParentNode = document) {
  const handler = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const el = target.closest<HTMLElement>("a,button,[data-meta-event]");
    if (!el) return;
    if (el instanceof HTMLButtonElement && el.type === "submit") return;
    if (el.closest("form") && el.tagName === "BUTTON") return;
    const explicit = el.getAttribute("data-meta-event");
    if (explicit && explicit !== "Contact") return;
    const href = el.getAttribute("href") || "";
    const isContact =
      explicit === "Contact" ||
      href.includes("#conversa") ||
      el.classList.contains("header-cta") ||
      (el.tagName === "A" && (el.classList.contains("button") || el.classList.contains("cv-primary")));
    if (!isContact) return;
    const label =
      el.getAttribute("data-meta-label") ||
      el.textContent?.replace(/\s+/g, " ").trim() ||
      "CTA";
    trackContactClick(label.slice(0, 120));
  };
  root.addEventListener("click", handler, { capture: true });
  return () => root.removeEventListener("click", handler, { capture: true });
}
