/**
 * Webhook / sistema de notificação Tray (app-level).
 * Payload: seller_id, scope_name, scope_id, act
 */

export type TrayNotificationPayload = {
  seller_id?: string | number;
  scope_name?: string;
  scope_id?: string | number;
  act?: string;
  app_code?: string | number;
  url_notification?: string;
};

const recentKeys = new Map<string, number>();
const DEDUPE_MS = 30_000;

export function parseTrayNotification(
  raw: string,
  contentType: string | null,
): TrayNotificationPayload {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw) as TrayNotificationPayload;
    } catch {
      return {};
    }
  }
  // form-urlencoded ou multipart fields simples
  const params = new URLSearchParams(raw);
  if ([...params.keys()].length > 0) {
    return {
      seller_id: params.get("seller_id") ?? undefined,
      scope_name: params.get("scope_name") ?? undefined,
      scope_id: params.get("scope_id") ?? undefined,
      act: params.get("act") ?? undefined,
      app_code: params.get("app_code") ?? undefined,
      url_notification: params.get("url_notification") ?? undefined,
    };
  }
  try {
    return JSON.parse(raw) as TrayNotificationPayload;
  } catch {
    return {};
  }
}

export function isTrayOrderNotification(
  payload: TrayNotificationPayload,
): boolean {
  return String(payload.scope_name || "").toLowerCase() === "order";
}

export function trayNotificationDedupeKey(
  payload: TrayNotificationPayload,
): string {
  return [
    payload.seller_id ?? "",
    payload.scope_name ?? "",
    payload.scope_id ?? "",
    payload.act ?? "",
  ].join(":");
}

/** true se deve processar; false se duplicata recente. */
export function shouldProcessTrayNotification(
  payload: TrayNotificationPayload,
): boolean {
  const key = trayNotificationDedupeKey(payload);
  const now = Date.now();
  for (const [k, ts] of recentKeys) {
    if (now - ts > DEDUPE_MS) recentKeys.delete(k);
  }
  const prev = recentKeys.get(key);
  if (prev && now - prev < DEDUPE_MS) return false;
  recentKeys.set(key, now);
  return true;
}
