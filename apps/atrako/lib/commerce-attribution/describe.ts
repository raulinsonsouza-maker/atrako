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

/** Texto da origem do pedido para card do lead e dashboard. */
export function describeOrderOrigin(s: OrderSourceView | null): OriginDescription {
  if (!s) return { title: "Origem ainda não calculada", detail: null, badge: null, lastVisit: null };
  const visit = s.storeSource
    ? [s.storeSource, s.storeMedium, s.storeContent].filter(Boolean).join(" / ")
    : null;

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
