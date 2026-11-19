import { NextRequest, NextResponse } from "next/server";
import { LP_DOMAINS } from "@/lib/lp-domains";
import { lpDomainWorkspaceId } from "@/lib/geo-hub/lp-workspace";
import { clientIp, rateLimit } from "@/lib/http/rate-limit";
import { fireAndForget, sendWebsiteEvent } from "@/lib/integrations/meta/capi";

const ALLOWED_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "Contact",
  "Lead",
  "CompleteRegistration",
  "Schedule",
  "SubmitApplication",
  "Search",
  "AddToCart",
  "InitiateCheckout",
]);

function str(v: unknown, max: number) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * Espelho CAPI dos eventos do pixel nas LPs (PageView, ViewContent, Contact, Lead…).
 * Só responde em hosts de LP; nunca devolve o token.
 */
export async function POST(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const lp = LP_DOMAINS[host];
  if (!lp) return new NextResponse(null, { status: 204 });

  const ip = clientIp(request.headers);
  if (!rateLimit(`capi:${ip}`, 40, 60_000)) return new NextResponse(null, { status: 204 });

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(await request.text()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const eventName = str(body.event_name ?? body.eventName, 50);
  const eventId = str(body.event_id ?? body.eventId, 100);
  if (!eventName || !eventId || !ALLOWED_EVENTS.has(eventName)) {
    return new NextResponse(null, { status: 204 });
  }

  const workspaceId = await lpDomainWorkspaceId(lp.workspaceSlug);
  if (!workspaceId) return new NextResponse(null, { status: 204 });

  const customRaw =
    body.custom_data && typeof body.custom_data === "object" && !Array.isArray(body.custom_data)
      ? (body.custom_data as Record<string, unknown>)
      : body.customData && typeof body.customData === "object" && !Array.isArray(body.customData)
        ? (body.customData as Record<string, unknown>)
        : null;
  const customData: Record<string, unknown> = {};
  if (customRaw) {
    for (const [k, v] of Object.entries(customRaw)) {
      if (customData && Object.keys(customData).length >= 24) break;
      if (typeof v === "string") customData[k.slice(0, 40)] = v.slice(0, 200);
      else if (typeof v === "number" && Number.isFinite(v)) customData[k.slice(0, 40)] = v;
      else if (typeof v === "boolean") customData[k.slice(0, 40)] = v;
      else if (Array.isArray(v)) customData[k.slice(0, 40)] = v.slice(0, 8).map(String).map((x) => x.slice(0, 80));
    }
  }

  fireAndForget(
    sendWebsiteEvent({
      workspaceId,
      eventName,
      eventId,
      eventSourceUrl: str(body.event_source_url ?? body.eventSourceUrl, 1000),
      clientIp: ip !== "unknown" ? ip : null,
      userAgent: request.headers.get("user-agent"),
      fbp: str(body.fbp, 200),
      fbc: str(body.fbc, 200),
      email: str(body.email, 160),
      phone: str(body.phone, 32),
      firstName: str(body.first_name ?? body.firstName, 80),
      lastName: str(body.last_name ?? body.lastName, 80),
      externalId: str(body.external_id ?? body.externalId, 120),
      customData: Object.keys(customData).length ? customData : null,
    }),
    `lp ${eventName}`,
  );

  return new NextResponse(null, { status: 204 });
}
