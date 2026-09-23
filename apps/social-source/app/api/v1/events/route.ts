import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isAuthError,
  requirePublicApiOrg,
} from "@/lib/symbius/attribution/auth";
import { trackEvent } from "@/lib/symbius/attribution/events";

const schema = z.object({
  event: z.string().min(1),
  event_name: z.string().optional(),
  event_id: z.string().optional().nullable(),
  anonymous_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  st_id: z.string().optional().nullable(),
  lead_id: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  timestamp: z.string().optional().nullable(),
  context: z
    .object({
      page: z
        .object({
          url: z.string().optional().nullable(),
          referrer: z.string().optional().nullable(),
        })
        .optional(),
      campaign: z
        .object({
          source: z.string().optional().nullable(),
          medium: z.string().optional().nullable(),
          name: z.string().optional().nullable(),
          content: z.string().optional().nullable(),
          term: z.string().optional().nullable(),
        })
        .optional(),
      click_ids: z
        .object({
          fbclid: z.string().optional().nullable(),
          gclid: z.string().optional().nullable(),
          ttclid: z.string().optional().nullable(),
          msclkid: z.string().optional().nullable(),
        })
        .optional(),
    })
    .optional(),
  properties: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requirePublicApiOrg(request);
  if (isAuthError(auth)) return auth;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const row = await trackEvent({
    organizationId: auth.organizationId,
    event: body.event || body.event_name || "custom",
    eventId: body.event_id,
    anonymousId: body.anonymous_id,
    sessionId: body.session_id,
    stId: body.st_id ?? body.lead_id,
    email: body.email,
    phone: body.phone,
    timestamp: body.timestamp,
    context: body.context,
    properties: body.properties,
  });

  return NextResponse.json({
    ok: true,
    event_id: row.eventId,
    name: row.name,
  });
}
