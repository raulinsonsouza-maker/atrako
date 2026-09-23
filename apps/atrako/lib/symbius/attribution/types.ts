export type TouchPoint = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  msclkid?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  timestamp?: string | null;
};

export type CampaignContext = {
  source?: string | null;
  medium?: string | null;
  name?: string | null;
  content?: string | null;
  term?: string | null;
};

export type ClickIds = {
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  msclkid?: string | null;
};

export type AttributionModel =
  | "first_touch"
  | "last_touch"
  | "linear"
  | "position_based"
  | "time_decay";

export type AliasType =
  | "igsid"
  | "email"
  | "email_hash"
  | "phone"
  | "phone_hash"
  | "external_customer";

export function touchFromCampaign(
  campaign?: CampaignContext | null,
  clickIds?: ClickIds | null,
  page?: { url?: string | null; referrer?: string | null } | null,
): TouchPoint {
  return {
    source: campaign?.source ?? null,
    medium: campaign?.medium ?? null,
    campaign: campaign?.name ?? null,
    content: campaign?.content ?? null,
    term: campaign?.term ?? null,
    fbclid: clickIds?.fbclid ?? null,
    gclid: clickIds?.gclid ?? null,
    ttclid: clickIds?.ttclid ?? null,
    msclkid: clickIds?.msclkid ?? null,
    landingPage: page?.url ?? null,
    referrer: page?.referrer ?? null,
    timestamp: new Date().toISOString(),
  };
}

export function isMeaningfulTouch(touch: TouchPoint | null | undefined): boolean {
  if (!touch) return false;
  return Boolean(
    touch.source ||
      touch.medium ||
      touch.campaign ||
      touch.fbclid ||
      touch.gclid ||
      touch.ttclid ||
      touch.msclkid,
  );
}
