import { prisma } from "@/lib/prisma";
import { sha256Hex } from "@/lib/crypto";
import { absoluteUrl } from "@/lib/utils";

export type MetaContentItem = {
  id: string;
  quantity: number;
  item_price: number;
};

type CapiEvent = {
  eventName: "Purchase" | "InitiateCheckout" | "AddToCart" | "ViewContent" | "PageView";
  eventId: string;
  email?: string;
  phone?: string;
  /** Nome completo — gera fn/ln hasheados */
  name?: string;
  /** CPF ou outro ID estável — hasheado como external_id */
  externalId?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  contents?: MetaContentItem[];
  numItems?: number;
  /** Product that owns the pixel / CAPI credentials for this event */
  productId?: string;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string;
  userAgent?: string;
  eventSourceUrl?: string;
};

export type ResolvedPixel = {
  pixelId: string | null;
  capiToken: string | null;
  source: "product" | "global" | "env" | "none";
};

/** Normaliza telefone BR para E.164 sem + (55…). */
export function normalizeBrPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Pixel do produto, com fallback para Config global / env. */
export async function resolvePixelForProduct(
  productId?: string | null,
): Promise<ResolvedPixel> {
  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { metaPixelId: true, metaCapiToken: true },
    });
    if (product?.metaPixelId) {
      const global = await prisma.pixelConfig.findUnique({ where: { id: "default" } });
      return {
        pixelId: product.metaPixelId,
        capiToken:
          product.metaCapiToken ||
          global?.capiToken ||
          process.env.META_CAPI_TOKEN ||
          null,
        source: "product",
      };
    }
  }

  const config = await prisma.pixelConfig.findUnique({ where: { id: "default" } });
  if (config?.pixelId) {
    return {
      pixelId: config.pixelId,
      capiToken: config.capiToken || process.env.META_CAPI_TOKEN || null,
      source: "global",
    };
  }

  const envPixel = process.env.META_PIXEL_ID || null;
  if (envPixel) {
    return {
      pixelId: envPixel,
      capiToken: process.env.META_CAPI_TOKEN || null,
      source: "env",
    };
  }

  return { pixelId: null, capiToken: null, source: "none" };
}

function buildUserData(event: CapiEvent) {
  const userData: Record<string, unknown> = {};

  if (event.email) userData.em = [sha256Hex(event.email)];

  if (event.phone) {
    const ph = normalizeBrPhone(event.phone);
    if (ph) userData.ph = [sha256Hex(ph)];
  }

  if (event.externalId) {
    const ext = event.externalId.replace(/\D/g, "") || event.externalId.trim();
    if (ext) userData.external_id = [sha256Hex(ext)];
  }

  if (event.name?.trim()) {
    const parts = event.name.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (parts[0]) userData.fn = [sha256Hex(parts[0])];
    if (parts.length > 1) userData.ln = [sha256Hex(parts[parts.length - 1])];
  }

  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;
  if (event.clientIp) userData.client_ip_address = event.clientIp;
  if (event.userAgent) userData.client_user_agent = event.userAgent;

  return userData;
}

export async function sendMetaCapiEvent(event: CapiEvent) {
  const { pixelId: finalPixel, capiToken: finalToken } = await resolvePixelForProduct(
    event.productId,
  );
  if (!finalPixel || !finalToken) {
    console.warn("[meta-capi] skipped: missing pixelId or capiToken", {
      productId: event.productId,
      eventName: event.eventName,
    });
    return { skipped: true };
  }

  const contents =
    event.contents ??
    (event.contentIds?.map((id) => ({
      id,
      quantity: 1,
      item_price:
        event.value != null && event.contentIds?.length
          ? event.value / event.contentIds.length
          : event.value ?? 0,
    })) ||
      undefined);

  const customData: Record<string, unknown> = {
    currency: event.currency ?? "BRL",
    content_type: "product",
  };
  if (event.value != null) customData.value = event.value;
  if (event.contentIds?.length) customData.content_ids = event.contentIds;
  if (event.contentName) customData.content_name = event.contentName;
  if (contents?.length) customData.contents = contents;
  if (event.numItems != null) customData.num_items = event.numItems;
  else if (contents?.length) {
    customData.num_items = contents.reduce((n, c) => n + c.quantity, 0);
  }

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: event.eventSourceUrl || absoluteUrl("/"),
        action_source: "website",
        user_data: buildUserData(event),
        custom_data: customData,
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_TEST_EVENT_CODE }
      : {}),
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${finalPixel}/events?access_token=${finalToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[meta-capi] error", res.status, json);
  }
  return json;
}
