/**
 * Envio de uma mensagem (e-mail Resend ou template WhatsApp) com MessageDelivery + snapshot.
 * Usado pelo motor de fluxos, campanhas e envios de teste.
 */

import { prisma } from "@/lib/db";
import type { EmailContent, RenderItem, WhatsAppContent } from "@/lib/flows/types";
import { renderEmail, listUnsubscribeHeaders, GMAIL_CLIP_BYTES } from "@/lib/flows/render-email";
import { loadEmailTheme } from "@/lib/flows/theme";
import {
  buildTrackedUrl,
  buildUnsubscribeUrl,
  newTrackingToken,
} from "@/lib/flows/tracking";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import { formatFrom, resendReady, resolveResend, resolvePlatformResend } from "@/lib/integrations/resend/connection";
import { sendResendEmail, sendResendBatch, type ResendEmailPayload } from "@/lib/integrations/resend/client";
import { getRecommendations } from "@/lib/flows/recommendations";
import { firstName, formatMoney, interpolate, variableValues } from "@/lib/flows/variables";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import { normalizeWaPhone, persistOutboundMessage, upsertWaConversation } from "@/lib/whatsapp/domain";
import {
  buildSendComponents,
  renderTemplatePreview,
  resolveTemplateForPurpose,
} from "@/lib/flows/wa-templates";
import { sendWhatsAppTemplateComponents, WaSendError } from "@/lib/integrations/whatsapp/messages";
import { isMarketingMessagesOnboarded, waCapacity, applyWaErrorToContact } from "@/lib/flows/wa-limits";

export type FlowContextData = {
  items?: RenderItem[];
  totalCents?: number | null;
  currency?: string;
  destination?: string | null;
  orderRef?: string | null;
  provider?: string | null;
  couponExpires?: string | null;
  includePurchased?: boolean;
};

export type SendContact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  phoneE164?: string | null;
  waMarketingOptOutAt?: Date | null;
  waMarketingBlockedUntil?: Date | null;
  waOptOutAt?: Date | null;
  waUndeliverableAt?: Date | null;
};

/** Número sem WhatsApp: tenta de novo só depois disso (a pessoa pode ter instalado). */
const WA_UNDELIVERABLE_RETRY_MS = 30 * 86_400_000;

export type SendOrigin = {
  flowId?: string | null;
  flowKey?: string | null;
  enrollmentId?: string | null;
  stepId?: string | null;
  stepPosition?: number | null;
  campaignId?: string | null;
  campaignSlug?: string | null;
};

export type SendResult =
  | { status: "SENT"; deliveryId: string }
  | { status: "SKIPPED" | "HELD" | "DEFERRED" | "BLOCKED" | "FAILED"; reason: string; deliveryId?: string; fallbackEmail?: boolean };

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;

/** Contato sintético de teste (`test-…`) não existe no banco. */
const dbContactId = (id: string) => (id.startsWith("test-") ? null : id);

function utm(origin: SendOrigin) {
  return {
    utmCampaign: origin.flowKey || origin.campaignSlug || "relacionamento",
    utmContent: origin.stepPosition != null ? `passo-${origin.stepPosition + 1}` : null,
  };
}

async function storeDefaults(clienteId: string) {
  const s = await prisma.workspaceSettings.findUnique({
    where: { clienteId },
    select: { messagingPrefs: true, currency: true },
  });
  const mp = (s?.messagingPrefs ?? {}) as Record<string, unknown>;
  return {
    storeUrl: typeof mp.storeUrl === "string" && mp.storeUrl ? mp.storeUrl : getServerPublicOrigin(),
    currency: s?.currency || "BRL",
  };
}

export type PreparedEmail = {
  deliveryId: string;
  payload: ResendEmailPayload;
  idempotencyKey: string;
};

/** Renderiza, cria MessageDelivery (QUEUED) e devolve o payload Resend. */
export async function prepareEmail(input: {
  clienteId: string;
  contact: SendContact;
  content: EmailContent;
  couponCode?: string | null;
  data: FlowContextData;
  origin: SendOrigin;
  idempotencyKey: string;
  isTest?: boolean;
  testTo?: string;
  draftTheme?: boolean;
}): Promise<PreparedEmail | { error: string }> {
  const to = (input.testTo || input.contact.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(to)) return { error: "invalid_email" };

  const conn = await resolveResend(input.clienteId);
  const platform = !conn && input.isTest ? await resolvePlatformResend() : null;
  if (!input.isTest && !resendReady(conn)) return { error: "resend_not_ready" };
  if (!conn?.fromEmail && !platform) return { error: "resend_not_connected" };

  const originUrl = getServerPublicOrigin();
  const token = newTrackingToken();
  const defaults = await storeDefaults(input.clienteId);
  const { theme, brand } = await loadEmailTheme(input.clienteId, { draft: input.draftTheme });
  const destination = input.data.destination || defaults.storeUrl;
  const items = input.data.items ?? [];
  const needsRecs = input.content.blocks.some((b) => b.type === "recommendations");
  const recommendations = needsRecs
    ? await getRecommendations(input.clienteId, {
        contactId: input.contact.id,
        seedTitles: items.map((i) => i.title),
        includePurchased: input.data.includePurchased,
      }).catch(() => [])
    : [];
  const unsubscribeUrl = buildUnsubscribeUrl(originUrl, input.clienteId, input.contact.id);

  const ctx = {
    contactName: input.contact.name,
    storeName: brand.storeName,
    couponCode: input.couponCode ?? null,
    couponExpires: input.data.couponExpires ?? null,
    items,
    totalCents: input.data.totalCents ?? null,
    currency: input.data.currency || defaults.currency,
    primaryUrl: destination,
    recommendations,
    unsubscribeUrl,
    trackUrl: (url: string | null | undefined, primary?: boolean) =>
      primary || !url ? `${originUrl}/r/${token}` : buildTrackedUrl(originUrl, token, url),
  };
  const rendered = renderEmail({ theme, content: input.content, ctx });
  if (rendered.bytes > GMAIL_CLIP_BYTES) {
    console.warn("[flows] e-mail acima de 102 KB (Gmail corta)", input.clienteId, rendered.bytes);
  }

  const { utmCampaign, utmContent } = utm(input.origin);
  const delivery = await prisma.messageDelivery.create({
    data: {
      clienteId: input.clienteId,
      channel: "EMAIL",
      flowId: input.origin.flowId ?? null,
      enrollmentId: input.origin.enrollmentId ?? null,
      stepId: input.origin.stepId ?? null,
      campaignId: input.origin.campaignId ?? null,
      contactId: dbContactId(input.contact.id),
      toAddress: to,
      trackingToken: token,
      subject: rendered.subject.slice(0, 300),
      couponCode: input.couponCode ?? null,
      status: "QUEUED",
      isTest: Boolean(input.isTest),
      contentSnapshot: {
        destination,
        medium: "email",
        utmCampaign,
        utmContent,
        couponCode: input.couponCode ?? null,
        shopify: input.data.provider === "SHOPIFY",
        content: input.content,
        ctx: {
          contactName: input.contact.name,
          items,
          totalCents: ctx.totalCents,
          currency: ctx.currency,
          recommendations,
          couponExpires: ctx.couponExpires,
        },
      } as object,
    },
  });

  const from = conn?.fromEmail ? formatFrom(conn, brand.storeName) : platform!.from;
  const tags = [
    { name: "delivery", value: delivery.id },
    ...(input.origin.flowKey ? [{ name: "flow", value: input.origin.flowKey.replace(/[^\w-]/g, "_") }] : []),
    ...(input.origin.stepPosition != null ? [{ name: "step", value: String(input.origin.stepPosition + 1) }] : []),
    ...(input.origin.campaignId ? [{ name: "campaign", value: input.origin.campaignId }] : []),
    { name: "test", value: input.isTest ? "1" : "0" },
  ];

  return {
    deliveryId: delivery.id,
    idempotencyKey: input.idempotencyKey,
    payload: {
      from,
      to: [to],
      subject: input.isTest ? `[Teste] ${rendered.subject}` : rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(conn?.replyTo ? { reply_to: conn.replyTo } : {}),
      headers: listUnsubscribeHeaders(unsubscribeUrl),
      tags,
    },
  };
}

async function apiKeyFor(clienteId: string, isTest?: boolean) {
  const conn = await resolveResend(clienteId);
  if (conn) return conn.apiKey;
  if (isTest) return (await resolvePlatformResend())?.apiKey ?? null;
  return null;
}

export async function sendEmailMessage(input: Parameters<typeof prepareEmail>[0]): Promise<SendResult> {
  const prepared = await prepareEmail(input);
  if ("error" in prepared) return { status: "SKIPPED", reason: prepared.error };
  const apiKey = await apiKeyFor(input.clienteId, input.isTest);
  if (!apiKey) return { status: "SKIPPED", reason: "resend_not_connected", deliveryId: prepared.deliveryId };
  try {
    const r = await sendResendEmail(apiKey, prepared.payload, prepared.idempotencyKey);
    await prisma.messageDelivery.update({
      where: { id: prepared.deliveryId },
      data: { providerMessageId: r.id, status: "SENT", sentAt: new Date() },
    });
    return { status: "SENT", deliveryId: prepared.deliveryId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.messageDelivery.update({
      where: { id: prepared.deliveryId },
      data: { status: "FAILED", failedAt: new Date(), error: msg.slice(0, 500) },
    });
    return { status: "FAILED", reason: msg, deliveryId: prepared.deliveryId };
  }
}

/** Lote de até 100 (campanhas). Idempotency-Key = hash da campanha + destinatários. */
export async function sendEmailBatch(clienteId: string, prepared: PreparedEmail[], idempotencyKey: string) {
  const apiKey = await apiKeyFor(clienteId);
  if (!apiKey || !prepared.length) return { sent: 0, failed: prepared.length };
  try {
    const ids = await sendResendBatch(apiKey, prepared.map((p) => p.payload), idempotencyKey);
    const now = new Date();
    await Promise.all(
      prepared.map((p, i) =>
        prisma.messageDelivery.update({
          where: { id: p.deliveryId },
          data: { providerMessageId: ids[i]?.id ?? null, status: "SENT", sentAt: now },
        }),
      ),
    );
    return { sent: prepared.length, failed: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.messageDelivery.updateMany({
      where: { id: { in: prepared.map((p) => p.deliveryId) } },
      data: { status: "FAILED", failedAt: new Date(), error: msg.slice(0, 500) },
    });
    return { sent: 0, failed: prepared.length, error: msg };
  }
}

// --------------------------------------------------------------------------- WhatsApp

export async function sendWhatsAppMessage(input: {
  clienteId: string;
  contact: SendContact;
  content: WhatsAppContent;
  couponCode?: string | null;
  data: FlowContextData;
  origin: SendOrigin;
  automatic: boolean;
  reservePercent: number;
  isTest?: boolean;
  testPhone?: string;
}): Promise<SendResult> {
  const wa = await resolveWhatsApp(input.clienteId);
  if (!wa) return { status: "SKIPPED", reason: "whatsapp_not_connected", fallbackEmail: true };
  const rawPhone = input.testPhone || input.contact.phoneE164 || input.contact.phone;
  const phone = rawPhone ? normalizeWaPhone(rawPhone) : "";
  if (phone.length < 10) return { status: "SKIPPED", reason: "no_phone", fallbackEmail: true };
  if (input.contact.waOptOutAt && !input.isTest) {
    return { status: "SKIPPED", reason: "wa_opt_out", fallbackEmail: true };
  }
  const undeliverable = input.contact.waUndeliverableAt;
  if (undeliverable && !input.isTest && Date.now() - undeliverable.getTime() < WA_UNDELIVERABLE_RETRY_MS) {
    return { status: "SKIPPED", reason: "wa_undeliverable", fallbackEmail: true };
  }

  const ref = input.content.templateRefId
    ? await prisma.waTemplateRef.findFirst({
        where: { id: input.content.templateRefId, clienteId: input.clienteId },
      })
    : input.content.purpose
      ? await resolveTemplateForPurpose(input.clienteId, input.content.purpose)
      : null;
  if (!ref || ref.status !== "APPROVED") {
    return { status: "HELD", reason: ref ? `template_${ref.status.toLowerCase()}` : "template_missing", fallbackEmail: true };
  }

  const marketing = (ref.category ?? "MARKETING").toUpperCase() === "MARKETING";
  const now = new Date();
  if (marketing && !input.isTest) {
    if (input.contact.waMarketingOptOutAt) {
      return { status: "BLOCKED", reason: "wa_marketing_opt_out", fallbackEmail: true };
    }
    if (input.contact.waMarketingBlockedUntil && input.contact.waMarketingBlockedUntil > now) {
      return { status: "BLOCKED", reason: "meta_user_limit_24h", fallbackEmail: true };
    }
  }
  if (!input.isTest) {
    const cap = await waCapacity(input.clienteId, input.reservePercent);
    const left = input.automatic ? cap.automaticLeft : cap.campaignLeft;
    if (left <= 0) return { status: "DEFERRED", reason: "portfolio_limit" };
  }

  const defaults = await storeDefaults(input.clienteId);
  const cliente = await prisma.cliente.findUnique({
    where: { id: input.clienteId },
    select: { nome: true, logoUrl: true },
  });
  const storeName = cliente?.nome ?? "Loja";
  const originUrl = getServerPublicOrigin();
  const token = newTrackingToken();
  const items = input.data.items ?? [];
  const destination = input.data.destination || defaults.storeUrl;

  const vars = variableValues({
    contactName: input.contact.name,
    storeName,
    couponCode: input.couponCode ?? null,
    couponExpires: input.data.couponExpires ?? null,
    items,
    totalCents: input.data.totalCents ?? null,
    currency: input.data.currency || defaults.currency,
    primaryUrl: destination,
    recommendations: [],
    unsubscribeUrl: "",
  });
  const params: Record<string, string> = {
    first_name: firstName(input.contact.name) || "cliente",
    product_name: items[0]?.title?.slice(0, 60) || "seus itens",
    store_name: storeName,
    coupon_code: input.couponCode ?? "",
    order_ref: input.data.orderRef ? `#${input.data.orderRef.replace(/^.*:/, "")}` : "",
    order_total: formatMoney(input.data.totalCents ?? null, input.data.currency || defaults.currency),
    expires: input.data.couponExpires || "por tempo limitado",
  };
  for (const [k, expr] of Object.entries(input.content.variables ?? {})) {
    params[k] = interpolate(expr, vars);
  }

  const cardSources = items.filter((i) => i.imageUrl).length >= 2
    ? items.filter((i) => i.imageUrl)
    : await getRecommendations(input.clienteId, { contactId: input.contact.id, seedTitles: items.map((i) => i.title), limit: 4 }).catch(() => []);
  const cardUrls = cardSources.map((c) => c.productUrl || destination);

  const { components, missing } = buildSendComponents(ref.components, ref.parameterFormat, {
    params,
    headerImageUrl: items.find((i) => i.imageUrl)?.imageUrl || cliente?.logoUrl || null,
    urlSuffix: token,
    couponCode: input.couponCode ?? null,
    ltoExpiresAt: new Date(Date.now() + 24 * 3_600_000),
    cards: cardSources.slice(0, 10).map((c, i) => ({ imageUrl: String(c.imageUrl), urlSuffix: `${token}~${i}` })),
  });
  if (missing.includes("coupon_code")) {
    return { status: "HELD", reason: "missing_coupon", fallbackEmail: true };
  }
  if (missing.includes("header_image") || missing.includes("carousel_cards")) {
    return { status: "HELD", reason: "missing_images", fallbackEmail: true };
  }

  const { utmCampaign, utmContent } = utm(input.origin);
  const preview = renderTemplatePreview(ref.components, params);
  const delivery = await prisma.messageDelivery.create({
    data: {
      clienteId: input.clienteId,
      channel: "WHATSAPP",
      flowId: input.origin.flowId ?? null,
      enrollmentId: input.origin.enrollmentId ?? null,
      stepId: input.origin.stepId ?? null,
      campaignId: input.origin.campaignId ?? null,
      contactId: dbContactId(input.contact.id),
      toAddress: phone,
      trackingToken: token,
      templateName: ref.name,
      couponCode: input.couponCode ?? null,
      status: "QUEUED",
      isTest: Boolean(input.isTest),
      pricingCategory: (ref.category ?? "MARKETING").toLowerCase(),
      contentSnapshot: {
        destination,
        medium: "whatsapp",
        utmCampaign,
        utmContent,
        couponCode: input.couponCode ?? null,
        shopify: input.data.provider === "SHOPIFY",
        cards: cardUrls,
        templateRefId: ref.id,
        preview,
        params,
      } as object,
    },
  });

  try {
    const marketingApi = marketing && (await isMarketingMessagesOnboarded(input.clienteId));
    const { wamid } = await sendWhatsAppTemplateComponents({
      workspaceId: input.clienteId,
      to: phone,
      templateName: ref.name,
      languageCode: ref.language,
      components,
      marketingApi,
    });
    await prisma.messageDelivery.update({
      where: { id: delivery.id },
      data: { providerMessageId: wamid, status: "SENT", sentAt: new Date() },
    });
    await prisma.waTemplateRef.update({ where: { id: ref.id }, data: { lastUsedAt: new Date() } });
    const conv = await upsertWaConversation({
      workspaceId: input.clienteId,
      phone,
      contactId: dbContactId(input.contact.id),
      contactName: input.contact.name,
    });
    await persistOutboundMessage({
      workspaceId: input.clienteId,
      conversationId: conv.id,
      body: preview,
      wamid,
      type: "template",
      templateName: ref.name,
    });
    return { status: "SENT", deliveryId: delivery.id };
  } catch (err) {
    const code = err instanceof WaSendError ? err.code : null;
    const msg = err instanceof Error ? err.message : String(err);
    const effect = await applyWaErrorToContact(dbContactId(input.contact.id), code);
    await prisma.messageDelivery.update({
      where: { id: delivery.id },
      data: {
        status: effect.blocked ? "BLOCKED" : "FAILED",
        failedAt: new Date(),
        error: msg.slice(0, 500),
        errorCode: code,
      },
    });
    return {
      status: effect.blocked ? "BLOCKED" : "FAILED",
      reason: msg,
      deliveryId: delivery.id,
      fallbackEmail: effect.fallbackEmail,
    };
  }
}
