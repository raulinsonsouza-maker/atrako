import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isAuthError,
  requirePublicApiOrg,
} from "@/lib/symbius/attribution/auth";
import { identifyLead } from "@/lib/symbius/attribution/identify";
import { touchFromCampaign } from "@/lib/symbius/attribution/types";

const schema = z.object({
  anonymous_id: z.string().optional().nullable(),
  st_id: z.string().optional().nullable(),
  lead_id: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  traits: z
    .object({
      name: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  aliases: z
    .array(
      z.object({
        type: z.enum([
          "igsid",
          "email",
          "email_hash",
          "phone",
          "phone_hash",
          "external_customer",
        ]),
        value: z.string().min(1),
      }),
    )
    .optional(),
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
  const identity = await identifyLead({
    organizationId: auth.organizationId,
    anonymousId: body.anonymous_id,
    stId: body.st_id ?? body.lead_id,
    email: body.email || null,
    phone: body.phone,
    name: body.traits?.name,
    aliases: body.aliases,
    leadSource: touchFromCampaign(
      body.context?.campaign,
      body.context?.click_ids,
      body.context?.page,
    ),
  });

  return NextResponse.json({
    ok: true,
    st_id: identity.stId,
    identity: {
      id: identity.id,
      st_id: identity.stId,
      email: identity.email,
      phone: identity.phone,
      name: identity.name,
      lead_source: identity.leadSource,
    },
  });
}
