import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { identifyLead } from "@/lib/symbius/attribution/identify";
import { sessionToTouch } from "@/lib/symbius/attribution/session";
import type {
  AttributionModel,
  TouchPoint,
} from "@/lib/symbius/attribution/types";
import { isMeaningfulTouch } from "@/lib/symbius/attribution/types";
import { fireOutboundWebhook } from "@/lib/symbius/integrations";
import { sendMetaCapiEvent } from "@/lib/symbius/attribution/metaCapi";
import { sendGa4Purchase } from "@/lib/symbius/attribution/ga4Sink";

export type PurchaseItemInput = {
  id?: string;
  product_id?: string;
  name?: string;
  quantity?: number;
  price?: number;
};

export type PurchaseInput = {
  organizationId: string;
  transactionId: string;
  stId?: string | null;
  leadId?: string | null;
  email?: string | null;
  phone?: string | null;
  customerId?: string | null;
  value: number;
  currency?: string;
  items?: PurchaseItemInput[];
  timestamp?: string | null;
  eventId?: string | null;
  status?: string;
  rawPayload?: Record<string, unknown>;
  model?: AttributionModel;
};

function touchKey(t: TouchPoint): string {
  return [
    t.source ?? "",
    t.medium ?? "",
    t.campaign ?? "",
    t.content ?? "",
    t.fbclid ?? "",
    gclidOrEmpty(t),
  ].join("|");
}

function gclidOrEmpty(t: TouchPoint) {
  return t.gclid ?? "";
}

function collectTouches(
  sessions: Array<{
    firstTouch: unknown;
    lastTouch: unknown;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    fbclid: string | null;
    gclid: string | null;
    ttclid: string | null;
    msclkid: string | null;
    landingPage: string | null;
    referrer: string | null;
    startedAt: Date;
  }>,
  leadSource: TouchPoint | null,
): TouchPoint[] {
  const touches: TouchPoint[] = [];
  if (leadSource && isMeaningfulTouch(leadSource)) touches.push(leadSource);
  for (const s of sessions) {
    const f = sessionToTouch(s, "first");
    const l = sessionToTouch(s, "last");
    if (isMeaningfulTouch(f)) touches.push(f);
    if (isMeaningfulTouch(l) && touchKey(l) !== touchKey(f)) touches.push(l);
  }
  const seen = new Set<string>();
  return touches.filter((t) => {
    const k = touchKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function computeAttribution(params: {
  model: AttributionModel;
  leadSource: TouchPoint | null;
  firstTouch: TouchPoint | null;
  lastTouch: TouchPoint | null;
  touches: TouchPoint[];
  value: number;
}) {
  const first =
    params.firstTouch && isMeaningfulTouch(params.firstTouch)
      ? params.firstTouch
      : params.leadSource;
  const last =
    params.lastTouch && isMeaningfulTouch(params.lastTouch)
      ? params.lastTouch
      : first;
  const leadSource = params.leadSource ?? first;
  const saleSource = last;

  let attributed = first;
  let attributedValue = params.value;
  let linearShares: Array<{ touch: TouchPoint; share: number; value: number }> | null =
    null;

  if (params.model === "last_touch") {
    attributed = last;
  } else if (params.model === "linear") {
    const touches =
      params.touches.length > 0
        ? params.touches
        : [first, last].filter((t): t is TouchPoint => Boolean(t && isMeaningfulTouch(t)));
    const n = Math.max(touches.length, 1);
    const share = 1 / n;
    linearShares = touches.map((touch) => ({
      touch,
      share,
      value: params.value * share,
    }));
    attributed = first;
    attributedValue = params.value;
  } else if (params.model === "position_based") {
    // 40% first, 40% last, 20% middle (U-shaped)
    const touches =
      params.touches.length > 0
        ? params.touches
        : [first, last].filter((t): t is TouchPoint => Boolean(t && isMeaningfulTouch(t)));
    if (touches.length === 1) {
      linearShares = [{ touch: touches[0], share: 1, value: params.value }];
    } else if (touches.length === 2) {
      linearShares = [
        { touch: touches[0], share: 0.5, value: params.value * 0.5 },
        { touch: touches[1], share: 0.5, value: params.value * 0.5 },
      ];
    } else {
      const midShare = 0.2 / Math.max(touches.length - 2, 1);
      linearShares = touches.map((touch, i) => {
        const share =
          i === 0 || i === touches.length - 1 ? 0.4 : midShare;
        return { touch, share, value: params.value * share };
      });
    }
    attributed = leadSource ?? first;
  } else if (params.model === "time_decay") {
    const touches =
      params.touches.length > 0
        ? params.touches
        : [first, last].filter((t): t is TouchPoint => Boolean(t && isMeaningfulTouch(t)));
    const halfLifeDays = 7;
    const now = Date.now();
    const weights = touches.map((touch) => {
      const ts = touch.timestamp ? Date.parse(touch.timestamp) : now;
      const ageDays = Math.max(0, (now - ts) / (86400 * 1000));
      return Math.pow(0.5, ageDays / halfLifeDays);
    });
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    linearShares = touches.map((touch, i) => {
      const share = weights[i] / sum;
      return { touch, share, value: params.value * share };
    });
    attributed = last;
  } else {
    // first_touch — product default for "leads do Flow geraram receita"
    attributed = leadSource ?? first;
  }

  return {
    leadSource,
    saleSource,
    firstTouch: first,
    lastTouch: last,
    attributed,
    attributedValue,
    linearShares,
  };
}

export async function ingestPurchase(input: PurchaseInput) {
  const orgId = input.organizationId;
  const externalOrderId = input.transactionId.trim();
  if (!externalOrderId) {
    throw new Error("transaction_id é obrigatório");
  }
  if (!Number.isFinite(input.value)) {
    throw new Error("value inválido");
  }

  const existing = await prisma.attributionOrder.findUnique({
    where: {
      organizationId_externalOrderId: {
        organizationId: orgId,
        externalOrderId,
      },
    },
    include: { attribution: true, items: true, identity: true },
  });
  if (existing) return existing;

  const stId = input.stId?.trim() || input.leadId?.trim() || null;
  const identity = await identifyLead({
    organizationId: orgId,
    stId,
    email: input.email,
    phone: input.phone,
    aliases: input.customerId
      ? [{ type: "external_customer", value: input.customerId }]
      : undefined,
  });

  const sessions = await prisma.trackingSession.findMany({
    where: {
      organizationId: orgId,
      visitor: { identityId: identity.id },
    },
    orderBy: { startedAt: "asc" },
    take: 50,
  });

  const leadSource = (identity.leadSource as TouchPoint | null) ?? null;
  const firstSession = sessions[0] ?? null;
  const lastSession = sessions[sessions.length - 1] ?? null;
  const firstTouch = firstSession
    ? sessionToTouch(firstSession, "first")
    : leadSource;
  const lastTouch = lastSession
    ? sessionToTouch(lastSession, "last")
    : firstTouch;
  const touches = collectTouches(sessions, leadSource);
  const model: AttributionModel = input.model ?? "first_touch";
  const computed = computeAttribution({
    model,
    leadSource,
    firstTouch,
    lastTouch,
    touches,
    value: input.value,
  });

  const occurredAt = input.timestamp ? new Date(input.timestamp) : new Date();
  const attr = computed.attributed;

  const order = await prisma.attributionOrder.create({
    data: {
      organizationId: orgId,
      externalOrderId,
      identityId: identity.id,
      customerExternalId: input.customerId ?? undefined,
      value: new Prisma.Decimal(input.value),
      currency: input.currency ?? "BRL",
      status: input.status ?? "paid",
      eventId: input.eventId ?? undefined,
      rawPayload: (input.rawPayload ?? {}) as object,
      occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
      items: {
        create: (input.items ?? []).map((it) => ({
          productId: String(it.id ?? it.product_id ?? "unknown"),
          name: it.name,
          quantity: it.quantity ?? 1,
          price: new Prisma.Decimal(it.price ?? 0),
        })),
      },
      attribution: {
        create: {
          model,
          leadSource: computed.leadSource as object | undefined,
          saleSource: computed.saleSource as object | undefined,
          firstTouch: computed.firstTouch as object | undefined,
          lastTouch: computed.lastTouch as object | undefined,
          attributedSource: attr?.source ?? undefined,
          attributedMedium: attr?.medium ?? undefined,
          attributedCampaign: attr?.campaign ?? undefined,
          attributedContent: attr?.content ?? undefined,
          attributedAdset: undefined,
          attributedAd: undefined,
          attributedValue: new Prisma.Decimal(computed.attributedValue),
          linearShares: computed.linearShares as object | undefined,
        },
      },
    },
    include: { attribution: true, items: true, identity: true },
  });

  void fireOutboundWebhook(orgId, "order.purchased", {
    transactionId: order.externalOrderId,
    stId: identity.stId,
    value: Number(order.value),
    currency: order.currency,
    attribution: order.attribution,
  });

  void sendMetaCapiEvent({
    organizationId: orgId,
    eventName: "Purchase",
    eventId: order.eventId ?? `purchase_${order.externalOrderId}`,
    value: Number(order.value),
    currency: order.currency,
    email: identity.email,
    phone: identity.phone,
  });

  void sendGa4Purchase({
    organizationId: orgId,
    transactionId: order.externalOrderId,
    value: Number(order.value),
    currency: order.currency,
    clientId: identity.stId,
  });

  void import("@/lib/symbius/integrations").then(({ syncLeadToCentralCrm }) =>
    syncLeadToCentralCrm({
      organizationId: orgId,
      email: identity.email ?? undefined,
      phone: identity.phone ?? undefined,
      nome: identity.name ?? undefined,
      stId: identity.stId,
      valor: Number(order.value),
      transactionId: order.externalOrderId,
      dadosMarketing: {
        attributedCampaign: attr?.campaign,
        attributedSource: attr?.source,
        attributedMedium: attr?.medium,
        model,
        leadSource: computed.leadSource,
        saleSource: computed.saleSource,
      },
    }),
  );

  return order;
}
