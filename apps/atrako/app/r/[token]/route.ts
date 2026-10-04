import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildDestination, readTrackedTarget } from "@/lib/flows/tracking";
import { applyDeliveryEvent } from "@/lib/flows/delivery-status";
import { getPublicOrigin } from "@/lib/http/public-origin";

const BOT_UA = /bot|crawler|spider|preview|scanner|safelinks|proofpoint|mimecast|barracuda|headless/i;

type Snapshot = {
  destination?: string;
  medium?: "email" | "whatsapp";
  utmCampaign?: string;
  utmContent?: string | null;
  couponCode?: string | null;
  shopify?: boolean;
  cards?: string[];
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params;
  // Carrossel WA: {token}~{índice do card}
  const [token, cardIndexRaw] = decodeURIComponent(rawToken).split("~");
  const cardIndex = cardIndexRaw != null ? Number(cardIndexRaw) : null;
  const origin = getPublicOrigin(request);
  const delivery = await prisma.messageDelivery.findUnique({
    where: { trackingToken: token },
    select: {
      id: true,
      clienteId: true,
      contactId: true,
      channel: true,
      couponCode: true,
      contentSnapshot: true,
      isTest: true,
    },
  });
  if (!delivery) return NextResponse.redirect(origin, 302);

  const snap = (delivery.contentSnapshot ?? {}) as Snapshot;
  const cardUrl =
    cardIndex != null && Number.isInteger(cardIndex) ? snap.cards?.[cardIndex] ?? null : null;
  const secondary =
    cardUrl ||
    readTrackedTarget(token, request.nextUrl.searchParams.get("u"), request.nextUrl.searchParams.get("s"));
  const raw = secondary || snap.destination;
  if (!raw) return NextResponse.redirect(origin, 302);

  const target = buildDestination(raw, {
    medium: snap.medium ?? (delivery.channel === "WHATSAPP" ? "whatsapp" : "email"),
    campaign: snap.utmCampaign ?? "relacionamento",
    content: snap.utmContent ?? null,
    couponCode: snap.couponCode ?? delivery.couponCode,
    shopify: Boolean(snap.shopify) && !secondary,
  });

  const ua = request.headers.get("user-agent") ?? "";
  if (!BOT_UA.test(ua) && !delivery.isTest) {
    await applyDeliveryEvent({
      deliveryId: delivery.id,
      clienteId: delivery.clienteId,
      contactId: delivery.contactId,
      event: "clicked",
      meta: { link: raw, primary: !secondary },
    }).catch((err) => console.warn("[r] click", err instanceof Error ? err.message : err));
  }

  return NextResponse.redirect(target, 302);
}
