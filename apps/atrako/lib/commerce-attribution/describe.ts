export type OrderSourceView = {
  channel: string;
  channelLabel: string;
  storeSource: string | null;
  storeMedium: string | null;
  storeContent: string | null;
  adMethod: string | null;
  adConfidence: string | null;
  adWindow: string | null;
  campaignName: string | null;
  adsetName: string | null;
  adName: string | null;
};

export type OriginDescription = {
  title: string;
  detail: string | null;
  badge: { label: string; tone: "ok" | "warn" } | null;
  lastVisit: string | null;
};

export type OrderVisitView = {
  storeCampaign: string | null;
  storeContent: string | null;
  referrer: string | null;
  landingUrl: string | null;
  deviceType: string | null;
  sessionPages: number | null;
  userAgent: string | null;
  minutesOnSite: number | null;
};

const CONTENT_LABELS: Record<string, string> = {
  link_in_bio: "Link na bio",
  linkinbio: "Link na bio",
  bio: "Link na bio",
  stories: "Stories",
  story: "Stories",
  reels: "Reels",
  reel: "Reels",
  feed: "Feed",
  post: "Post",
  direct: "Direct",
  dm: "Direct",
  highlights: "Destaques",
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
};

function referrerHost(raw: string | null) {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^(www|l|lm|m|out)\./, "");
  } catch {
    return null;
  }
}

function landingPath(raw: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
    return path === "/" ? "página inicial" : path;
  } catch {
    return null;
  }
}

function inAppBrowser(ua: string | null) {
  if (!ua) return null;
  if (/Instagram/i.test(ua)) return "app do Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "app do Facebook";
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return "app do TikTok";
  return null;
}

function elapsed(minutes: number) {
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Visita que gerou o pedido, em frases curtas — só o que a loja gravou. */
export function describeVisit(v: OrderVisitView): { arrival: string | null; session: string | null } {
  const content = v.storeContent && !/^\d+$/.test(v.storeContent)
    ? CONTENT_LABELS[v.storeContent.toLowerCase()] ?? v.storeContent
    : null;
  const ownHost = referrerHost(v.landingUrl);
  const refHost = referrerHost(v.referrer);
  const host = refHost && refHost !== ownHost ? refHost : null;
  const path = landingPath(v.landingUrl);
  const arrival = [
    content,
    v.storeCampaign && !/^\d+$/.test(v.storeCampaign) ? `Campanha ${v.storeCampaign}` : null,
    host ? `veio de ${host}` : null,
    path ? `entrou por ${path}` : null,
  ].filter(Boolean);

  const device = v.deviceType ? DEVICE_LABELS[v.deviceType.toLowerCase()] ?? v.deviceType : null;
  const app = inAppBrowser(v.userAgent);
  const session = [
    device && app ? `${device} · ${app}` : device ?? app,
    v.sessionPages ? `${v.sessionPages} ${v.sessionPages === 1 ? "página vista" : "páginas vistas"}` : null,
    v.minutesOnSite != null ? `chegou ${elapsed(v.minutesOnSite)} antes do pedido` : null,
  ].filter(Boolean);

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    arrival: arrival.length ? cap(arrival.join(" · ")) : null,
    session: session.length ? session.join(" · ") : null,
  };
}

/** Texto da origem do pedido para card do lead e dashboard. */
export function describeOrderOrigin(s: OrderSourceView | null): OriginDescription {
  if (!s) return { title: "Origem ainda não calculada", detail: null, badge: null, lastVisit: null };
  const visitParts = [s.storeSource, s.storeMedium, s.storeContent].filter(
    (v): v is string => !!v && !v.startsWith("("),
  );
  const visit = visitParts.length ? visitParts.join(" / ") : null;

  if (s.adMethod) {
    const detail = [s.campaignName && `Campanha ${s.campaignName}`, s.adsetName && `Conjunto ${s.adsetName}`]
      .filter(Boolean)
      .join(" · ");
    const tracked = s.adConfidence === "confirmed";
    const how = s.adWindow === "view" ? "viu o anúncio" : "clicou no anúncio";
    return {
      title: `Meta Ads · ${s.adName ?? "anúncio"}`,
      detail: detail || null,
      badge: tracked
        ? { label: "Clique rastreado na loja", tone: "ok" }
        : { label: `Cruzado com o Meta · ${how}`, tone: "ok" },
      lastVisit: s.adMethod === "meta_match" && visit ? `Última visita antes da compra: ${visit}` : null,
    };
  }
  return {
    title: s.channelLabel,
    detail: visit,
    badge: null,
    lastVisit: null,
  };
}
