/**
 * Webhooks Nuvemshop — register + parse push.
 */

import { nuvemshopFetchWithCreds } from "./client";

export const NUVEMSHOP_ORDER_EVENTS = [
  "order/created",
  "order/updated",
  "order/paid",
  "order/cancelled",
] as const;

export type NuvemshopPushPayload = {
  store_id?: number | string;
  event?: string;
  id?: number | string;
};

export function isNuvemshopOrderEvent(event: string | undefined): boolean {
  if (!event) return false;
  return (NUVEMSHOP_ORDER_EVENTS as readonly string[]).includes(event);
}

export async function registerNuvemshopWebhooks(input: {
  storeId: string;
  accessToken: string;
  clientId: string;
  callbackBaseUrl: string;
  workspaceId?: string;
}): Promise<{ registered: string[]; errors: string[] }> {
  const base = input.callbackBaseUrl.replace(/\/$/, "");
  const url = input.workspaceId
    ? `${base}/api/webhooks/nuvemshop?workspaceId=${encodeURIComponent(input.workspaceId)}`
    : `${base}/api/webhooks/nuvemshop`;

  const registered: string[] = [];
  const errors: string[] = [];

  let existing: Array<{ id?: number; event?: string; url?: string }> = [];
  try {
    existing = await nuvemshopFetchWithCreds({
      storeId: input.storeId,
      accessToken: input.accessToken,
      clientId: input.clientId,
      path: "/webhooks",
    });
    if (!Array.isArray(existing)) existing = [];
  } catch (err) {
    errors.push(`list: ${err instanceof Error ? err.message : "failed"}`);
  }

  for (const event of NUVEMSHOP_ORDER_EVENTS) {
    const already = existing.some(
      (w) => w.event === event && typeof w.url === "string" && w.url.includes("/api/webhooks/nuvemshop"),
    );
    if (already) {
      registered.push(event);
      continue;
    }
    try {
      await nuvemshopFetchWithCreds({
        storeId: input.storeId,
        accessToken: input.accessToken,
        clientId: input.clientId,
        path: "/webhooks",
        method: "POST",
        body: { event, url },
      });
      registered.push(event);
    } catch (err) {
      errors.push(`${event}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  return { registered, errors };
}
