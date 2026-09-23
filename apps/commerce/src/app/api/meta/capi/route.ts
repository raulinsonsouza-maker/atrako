import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMetaCapiEvent } from "@/lib/meta";

const contentItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int().positive(),
  item_price: z.number().nonnegative(),
});

const schema = z.object({
  eventName: z.enum(["Purchase", "InitiateCheckout", "AddToCart", "ViewContent", "PageView"]),
  eventId: z.string().min(8),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  externalId: z.string().optional(),
  value: z.number().optional(),
  currency: z.string().optional(),
  contentIds: z.array(z.string()).optional(),
  contentName: z.string().optional(),
  contents: z.array(contentItemSchema).optional(),
  numItems: z.number().int().positive().optional(),
  productId: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  eventSourceUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());

    // Purchase pelo CAPI público: só via approveOrder (evita Purchase falso)
    if (body.eventName === "Purchase") {
      return NextResponse.json(
        { error: "Purchase deve ser enviado pelo servidor após aprovação" },
        { status: 403 },
      );
    }

    const result = await sendMetaCapiEvent({
      ...body,
      clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
      eventSourceUrl: body.eventSourceUrl || req.headers.get("referer") || undefined,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro CAPI";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
