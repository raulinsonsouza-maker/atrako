"use client";

import Script from "next/script";

export function MetaPixel({ pixelId }: { pixelId?: string | null }) {
  if (!pixelId) return null;
  return (
    <>
      <Script id={`meta-pixel-${pixelId}`} strategy="afterInteractive">{`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${pixelId}');
        fbq('track', 'PageView');
      `}</Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export type MetaEventName =
  | "Purchase"
  | "InitiateCheckout"
  | "AddToCart"
  | "ViewContent"
  | "PageView";

export type MetaContentItem = {
  id: string;
  quantity: number;
  item_price: number;
};

export type MetaTrackParams = {
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  contents?: MetaContentItem[];
  currency?: string;
  value?: number;
  num_items?: number;
  [key: string]: unknown;
};

function getCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Monta fbc a partir do cookie ou do fbclid da URL (padrão Meta). */
export function buildFbc(fbclid?: string | null) {
  const fromCookie = getCookie("_fbc");
  if (fromCookie) return fromCookie;
  if (!fbclid) return undefined;
  return `fb.1.${Date.now()}.${fbclid}`;
}

export function getMetaAttribution(searchParams?: URLSearchParams | null) {
  const fbclid =
    searchParams?.get("fbclid") ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("fbclid")
      : null);
  return {
    fbp: getCookie("_fbp"),
    fbc: buildFbc(fbclid),
    fbclid: fbclid || undefined,
  };
}

export function newMetaEventId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildProductEventParams(input: {
  contentIds: string[];
  value: number;
  contentName?: string;
  contents?: MetaContentItem[];
}): MetaTrackParams {
  const contents =
    input.contents ??
    input.contentIds.map((id) => ({
      id,
      quantity: 1,
      item_price: input.value / Math.max(input.contentIds.length, 1),
    }));
  return {
    content_ids: input.contentIds,
    content_name: input.contentName,
    content_type: "product",
    contents,
    currency: "BRL",
    value: input.value,
    num_items: contents.reduce((n, c) => n + c.quantity, 0),
  };
}

/** Dispara fbq com retry se o script ainda não carregou. */
export function trackMeta(
  event: string,
  params?: MetaTrackParams,
  eventId?: string,
) {
  if (typeof window === "undefined") return;

  const fire = () => {
    if (!window.fbq) return false;
    if (eventId) {
      window.fbq("track", event, params ?? {}, { eventID: eventId });
    } else {
      window.fbq("track", event, params ?? {});
    }
    return true;
  };

  if (fire()) return;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (fire() || attempts >= 50) window.clearInterval(timer);
  }, 100);
}

type DualTrackInput = {
  eventName: MetaEventName;
  productId: string;
  params: MetaTrackParams;
  eventId?: string;
  email?: string;
  phone?: string;
  externalId?: string;
  /** Evita reenvio no mesmo browser (ex.: Purchase). */
  onceKey?: string;
};

/**
 * Browser Pixel + CAPI com o mesmo event_id (deduplicação Meta).
 */
export function trackMetaDual(input: DualTrackInput): string {
  const eventId = input.eventId || newMetaEventId();

  if (input.onceKey && typeof window !== "undefined") {
    const key = `meta_${input.onceKey}`;
    try {
      if (sessionStorage.getItem(key)) return eventId;
      sessionStorage.setItem(key, "1");
    } catch {
      // private mode — segue sem idempotência local
    }
  }

  trackMeta(input.eventName, input.params, eventId);

  if (typeof window === "undefined") return eventId;

  const { fbp, fbc } = getMetaAttribution();
  const contentIds =
    (input.params.content_ids as string[] | undefined) ?? [input.productId];

  void fetch("/api/meta/capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName: input.eventName,
      eventId,
      productId: input.productId,
      contentIds,
      contentName: input.params.content_name,
      contents: input.params.contents,
      numItems: input.params.num_items,
      value: typeof input.params.value === "number" ? input.params.value : undefined,
      currency: (input.params.currency as string) || "BRL",
      email: input.email,
      phone: input.phone,
      externalId: input.externalId,
      fbp,
      fbc,
      eventSourceUrl: window.location.href,
    }),
    keepalive: true,
  }).catch(() => undefined);

  return eventId;
}
