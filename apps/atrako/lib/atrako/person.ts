/**
 * Person hub — contato canônico por workspace.
 * Dedup: phone (E.164 digits) primeiro, depois email.
 * Todo canal (form, WA, commerce, CRM) passa por aqui.
 */

import { prisma } from "@/lib/db";
import { isRevenueOrder, orderStatusLabel } from "@/lib/commerce-attribution/order-status";
import { describeOrderOrigin } from "@/lib/commerce-attribution/describe";
import { CHANNEL_LABELS, type OrderChannel } from "@/lib/commerce-attribution/store-source";
import { LOST_REASON_LABELS, readStageHistory, type LostReason } from "@/lib/crm/stage-history";
import { formatLocation, orderDetails } from "@/lib/commerce/order-details";
import { mlShippingLabel } from "@/lib/integrations/mercadolivre/buyer-facts";

export function normalizePersonPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
const TYPO_DOMAINS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "hotmail.con": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.com.br.": "hotmail.com.br",
  "outlok.com": "outlook.com",
  "yahoo.con": "yahoo.com",
};

export function normalizePersonEmail(raw?: string | null): string | null {
  if (!raw) return null;
  let email = raw.trim().toLowerCase().replace(/\s+/g, "");
  const at = email.lastIndexOf("@");
  if (at > 0) {
    const domain = email.slice(at + 1);
    if (TYPO_DOMAINS[domain]) email = `${email.slice(0, at)}@${TYPO_DOMAINS[domain]}`;
  }
  if (email.length < 6 || email.length > 255 || !EMAIL_RE.test(email)) return null;
  return email;
}

/** E.164 (+55…) para envio WA e matching de públicos. Sem DDI assume Brasil. */
export function toPhoneE164(raw?: string | null): string | null {
  const digits = normalizePersonPhone(raw);
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

async function ensurePipeline(clienteId: string) {
  const existing = await prisma.crmPipeline.findFirst({
    where: { clienteId, isDefault: true },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (existing) return existing;
  // role ENTRY/WON — campo novo; cast até prisma generate atualizar
  return prisma.crmPipeline.create({
    data: {
      clienteId,
      name: "Principal",
      isDefault: true,
      stages: {
        create: [
          { name: "Novo", order: 0, color: "#8E8E93", role: "ENTRY" },
          { name: "Qualificado", order: 1, color: "#0066cc" },
          { name: "Proposta", order: 2, color: "#FF9500" },
          { name: "Ganho", order: 3, color: "#34C759", role: "WON" },
        ],
      },
    } as never,
    include: { stages: { orderBy: { order: "asc" } } },
  });
}

export type UpsertPersonInput = {
  workspaceId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Checkbox de consentimento marcado (form/LP/importação) — LGPD */
  marketingConsent?: boolean;
  consentSource?: string | null;
};

/**
 * Resolve ou cria NativeContact único.
 * Merge: se achar por phone e outro por email, prefere o do phone e completa dados.
 */
export async function upsertPersonContact(input: UpsertPersonInput) {
  const phone = normalizePersonPhone(input.phone);
  const email = normalizePersonEmail(input.email);
  const name =
    (typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 200)
      : null) || "Contato";

  if (!phone && !email) {
    return prisma.nativeContact.create({
      data: {
        clienteId: input.workspaceId,
        name,
        email: null,
        phone: null,
        metadata: {
          ...(input.metadata ?? {}),
          source: input.source ?? undefined,
          anonymous: true,
        },
      },
    });
  }

  let byPhone = phone
    ? await prisma.nativeContact.findFirst({
        where: { clienteId: input.workspaceId, phone },
      })
    : null;
  let byEmail =
    email && !byPhone
      ? await prisma.nativeContact.findFirst({
          where: { clienteId: input.workspaceId, email },
        })
      : email && byPhone
        ? await prisma.nativeContact.findFirst({
            where: {
              clienteId: input.workspaceId,
              email,
              id: { not: byPhone.id },
            },
          })
        : null;

  // Merge: contact por email duplicado → mover leads/WA para o do phone e soft-clear email dup
  if (byPhone && byEmail && byPhone.id !== byEmail.id) {
    await prisma.nativeLead.updateMany({
      where: { contactId: byEmail.id },
      data: { contactId: byPhone.id },
    });
    await prisma.waConversation.updateMany({
      where: { contactId: byEmail.id },
      data: { contactId: byPhone.id },
    });
    await prisma.commerceOrder.updateMany({
      where: { contactId: byEmail.id },
      data: { contactId: byPhone.id },
    });
    await prisma.nativeContact.update({
      where: { id: byEmail.id },
      data: {
        email: null,
        phone: byEmail.phone === phone ? null : byEmail.phone,
        metadata: {
          ...((byEmail.metadata as object) || {}),
          mergedInto: byPhone.id,
          mergedAt: new Date().toISOString(),
        },
      },
    });
    byEmail = null;
  }

  const existing = byPhone || byEmail;
  if (existing) {
    const nextMeta = {
      ...((existing.metadata as object) || {}),
      ...(input.metadata ?? {}),
      ...(input.source
        ? {
            sources: Array.from(
              new Set([
                ...(((existing.metadata as { sources?: string[] } | null)?.sources) ?? []),
                input.source,
              ]),
            ).slice(-20),
          }
        : {}),
    };
    return prisma.nativeContact.update({
      where: { id: existing.id },
      data: {
        name: name !== "Contato" ? name : existing.name,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        phoneE164: toPhoneE164(phone ?? existing.phone) ?? existing.phoneE164,
        ...(input.marketingConsent && !existing.marketingConsentAt
          ? { marketingConsentAt: new Date(), consentSource: (input.consentSource ?? input.source ?? "form").slice(0, 40) }
          : {}),
        metadata: nextMeta,
      },
    });
  }

  return prisma.nativeContact.create({
    data: {
      clienteId: input.workspaceId,
      name,
      email,
      phone,
      phoneE164: toPhoneE164(phone),
      ...(input.marketingConsent
        ? { marketingConsentAt: new Date(), consentSource: (input.consentSource ?? input.source ?? "form").slice(0, 40) }
        : {}),
      metadata: {
        ...(input.metadata ?? {}),
        source: input.source ?? undefined,
        sources: input.source ? [input.source] : [],
      },
    },
  });
}

/** Campos de first-touch que não devem ser sobrescritos no merge do lead. */
const FIRST_TOUCH_META_KEYS = [
  "formId",
  "formSlug",
  "formName",
  "pageSlug",
  "pageUrl",
  "pageProductId",
  "convertedAt",
] as const;

const FIRST_TOUCH_CHANNELS = new Set(["lp", "form"]);

/**
 * Mescla metadata preservando first-touch (LP/form).
 * Dados novos de checkout vão para lastTouch* quando colidem.
 */
export function mergeLeadAttributionMeta(
  prev: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...prev };
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;

    if ((FIRST_TOUCH_META_KEYS as readonly string[]).includes(key)) {
      if (prev[key] == null || prev[key] === "") {
        out[key] = value;
      }
      continue;
    }

    if (key === "channel") {
      const prevChannel = typeof prev.channel === "string" ? prev.channel : "";
      if (FIRST_TOUCH_CHANNELS.has(prevChannel)) {
        out.lastTouchChannel = value;
        out.lastTouchAt = now;
      } else {
        out.channel = value;
        out.lastTouchChannel = value;
        out.lastTouchAt = now;
      }
      continue;
    }

    out[key] = value;
  }

  out.lastTouchAt =
    typeof incoming.lastTouchAt === "string" ? incoming.lastTouchAt : now;
  if (incoming.source != null) {
    out.lastTouchSource = incoming.source;
  }

  return out;
}

/** Texto curto de atribuição LP + form a partir de metadata. */
export function formatAttributionDetail(
  meta: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!meta) return undefined;
  const parts: string[] = [];
  const pageSlug = typeof meta.pageSlug === "string" ? meta.pageSlug : "";
  const formLabel =
    (typeof meta.formName === "string" && meta.formName) ||
    (typeof meta.formSlug === "string" && meta.formSlug) ||
    "";
  if (pageSlug) parts.push(`LP ${pageSlug}`);
  if (formLabel) parts.push(`Form ${formLabel}`);
  return parts.length ? parts.join(" · ") : undefined;
}

/**
 * Um card por pessoa: reaproveita o lead do contato (aberto, ganho ou perdido) — nova compra,
 * carrinho ou conversa entram no mesmo card. Só cria quando o contato ainda não tem lead.
 */
export async function ensureOpenNativeLead(input: {
  workspaceId: string;
  contactId: string;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const pipeline = await ensurePipeline(input.workspaceId);
  return prisma.$transaction(async (tx) => {
    // Webhooks simultâneos do mesmo contato não podem criar dois cards.
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${`lead:${input.contactId}`}))) AS l`;
    const leads = await tx.nativeLead.findMany({
      where: { clienteId: input.workspaceId, contactId: input.contactId },
      include: { contact: true, stage: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    const existing = leads.find((l) => l.status === "OPEN") ?? leads[0];
    if (existing) {
      if (!input.source && !input.metadata) return existing;
      const prev = (existing.metadata as Record<string, unknown> | null) ?? {};
      const incoming = {
        ...(input.metadata ?? {}),
        ...(input.source ? { source: input.source } : {}),
      };
      return tx.nativeLead.update({
        where: { id: existing.id },
        data: {
          source: existing.source || input.source || undefined,
          metadata: mergeLeadAttributionMeta(prev, incoming) as never,
        },
        include: { contact: true, stage: true },
      });
    }

    const stages = pipeline.stages as Array<{ id: string; name: string; role?: string | null }>;
    const entryStage =
      stages.find((s) => s.role === "ENTRY") ??
      stages.find((s) => /^novo$/i.test(s.name)) ??
      stages[0];
    return tx.nativeLead.create({
      data: {
        clienteId: input.workspaceId,
        contactId: input.contactId,
        stageId: entryStage?.id,
        source: input.source ?? "inbound",
        status: "OPEN",
        metadata: (input.metadata ?? undefined) as never,
      },
      include: { contact: true, stage: true },
    });
  });
}

/** Atalho: pessoa + lead aberto. */
export async function upsertPersonAndLead(input: UpsertPersonInput) {
  const contact = await upsertPersonContact(input);
  const lead = await ensureOpenNativeLead({
    workspaceId: input.workspaceId,
    contactId: contact.id,
    source: input.source,
    metadata: input.metadata,
  });
  return { contact, lead };
}

const STORE_PROVIDER_LABELS: Record<string, string> = {
  SHOPIFY: "Shopify",
  WOOCOMMERCE: "WooCommerce",
  MERCADO_LIVRE: "Mercado Livre",
  NUVEMSHOP: "Nuvemshop",
  TRAY: "Tray",
  SHOPEE: "Shopee",
  TIKTOK_SHOP: "TikTok Shop",
  COMMERCE: "Checkout próprio",
  FOOD: "Food",
};

export function storeProviderLabel(provider: string) {
  return STORE_PROVIDER_LABELS[provider] ?? provider;
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
  tiktokshop: "TikTok Shop",
  woocommerce: "WooCommerce",
  shopify: "Shopify",
  nuvemshop: "Nuvemshop",
  tray: "Tray",
  magalu: "Magalu",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  meta: "Meta",
};

/** `mercadolivre` e `MERCADO_LIVRE` viram o mesmo nome. */
export function leadSourceLabel(source: string) {
  const raw = source.trim();
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  return STORE_PROVIDER_LABELS[upper] ?? LEAD_SOURCE_LABELS[raw.toLowerCase()] ?? raw;
}

export { orderStatusLabel };

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export type JourneyItem = {
  at: string;
  type: string;
  title: string;
  detail?: string;
  href?: string;
  meta?: Record<string, unknown>;
};

const TZ = "America/Sao_Paulo";

function dayKey(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

/** "14:30" no mesmo dia da referência; "12/10 14:30" em outro dia. */
function fmtLag(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} dias`;
}

function clock(d: Date, ref: Date) {
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (dayKey(d) === dayKey(ref)) return time;
  return `${d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" })} ${time}`;
}

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

const FLOW_EXIT_REASONS: Record<string, string> = {
  removed_manually: "removido manualmente",
  purchased: "comprou",
  cart_removed: "carrinho fechado",
  wa_optout: "saiu do WhatsApp",
  wa_stop: "pediu para parar",
  unsubscribe: "descadastrou",
  bounce: "e-mail inválido",
  complaint: "marcou como spam",
};

const BOOKING_STATUS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  CANCELED: "Cancelado",
  COMPLETED: "Realizado",
  NO_SHOW: "Não compareceu",
};

const WA_MEDIA: Record<string, string> = {
  image: "Imagem",
  audio: "Áudio",
  voice: "Áudio",
  video: "Vídeo",
  document: "Documento",
  sticker: "Figurinha",
  location: "Localização",
  contacts: "Contato",
  reaction: "Reação",
};

/** Desempate no mesmo instante: causa antes de efeito. */
const TYPE_ORDER: Record<string, number> = {
  "contact.created": 0,
  "lead.created": 1,
  "form.completed": 2,
  "flow.enrolled": 3,
  "flow.converted": 8,
  "flow.exited": 8,
  "flow.completed": 8,
  "lead.won": 9,
  "lead.lost": 9,
};

const MESSAGE_SENT = new Set(["SENT", "DELIVERED", "OPENED", "CLICKED", "CONVERTED"]);
const MESSAGE_FAILED = new Set(["BOUNCED", "COMPLAINED", "FAILED"]);

function orderTitle(externalId: string, status: string | null | undefined, cents: number) {
  const label = orderStatusLabel(status)?.toLowerCase();
  if (isRevenueOrder(status)) return `Pedido #${externalId} pago · ${brl(cents)}`;
  return `Pedido #${externalId}${label ? ` ${label}` : ""} · ${brl(cents)}`;
}

function itemsSummary(items: Array<{ title: string; quantity?: number | null }>) {
  return (
    items
      .map((i) => (i.quantity && i.quantity > 1 ? `${i.quantity}× ${i.title}` : i.title))
      .join(", ") || null
  );
}

/** Timeline unificada da pessoa (CRM / mensagens / WA / pedidos / agenda). */
export async function getPersonJourney(workspaceId: string, contactId: string): Promise<{
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    metadata: unknown;
    createdAt: Date;
  };
  items: JourneyItem[];
}> {
  const contact = await prisma.nativeContact.findFirst({
    where: { id: contactId, clienteId: workspaceId },
  });
  if (!contact) throw new Error("contact not found");

  const phone = contact.phone;
  const email = contact.email;

  const [leads, conversations, orders, bookings, marketplaceOrders, deliveries, enrollments, carts] =
    await Promise.all([
      prisma.nativeLead.findMany({
        where: { clienteId: workspaceId, contactId },
        include: { stage: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.waConversation.findMany({
        where: {
          clienteId: workspaceId,
          OR: [{ contactId }, ...(phone ? [{ phone }] : [])],
        },
        include: {
          messages: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      }),
      prisma.commerceOrder.findMany({
        where: {
          clienteId: workspaceId,
          OR: [
            { contactId },
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
        },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.agendaBooking.findMany({
        where: {
          clienteId: workspaceId,
          OR: [
            ...(email ? [{ customerEmail: email }] : []),
            ...(phone
              ? [{ customerPhone: phone }, { customerPhone: { contains: phone.slice(-8) } }]
              : []),
          ],
        },
        include: { service: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.marketplaceOrder.findMany({
        where: {
          clienteId: workspaceId,
          OR: [
            { contactId },
            ...(email ? [{ buyerEmail: email }] : []),
            ...(phone ? [{ buyerPhone: phone }] : []),
          ],
        },
        include: { items: { take: 10 }, source: true },
        orderBy: { occurredAt: "desc" },
        take: 100,
      }),
      prisma.messageDelivery.findMany({
        where: { clienteId: workspaceId, contactId, isTest: false },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.messageFlowEnrollment.findMany({
        where: { clienteId: workspaceId, contactId },
        include: { flow: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.abandonedCart.findMany({
        where: { clienteId: workspaceId, contactId, status: { in: ["OPEN", "RECOVERED", "EXPIRED"] } },
        orderBy: { abandonedAt: "desc" },
        take: 20,
      }),
    ]);

  const leadIds = leads.map((l) => l.id);
  const ledger =
    email || leadIds.length
      ? await prisma.workspaceLedgerEntry.findMany({
          where: {
            clienteId: workspaceId,
            type: "INCOME",
            OR: [
              ...(email ? [{ contact: email }] : []),
              ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
            ],
          },
          orderBy: { occurredAt: "asc" },
          take: 50,
        })
      : [];

  const flowIds = Array.from(new Set(deliveries.map((d) => d.flowId).filter((v): v is string => !!v)));
  const campaignIds = Array.from(new Set(deliveries.map((d) => d.campaignId).filter((v): v is string => !!v)));
  const [flows, campaigns] = await Promise.all([
    flowIds.length
      ? prisma.messageFlow.findMany({ where: { id: { in: flowIds } }, select: { id: true, name: true } })
      : [],
    campaignIds.length
      ? prisma.messageCampaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } })
      : [],
  ]);
  const flowName = new Map(flows.map((f) => [f.id, f.name]));
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));

  const items: JourneyItem[] = [];
  const orderKey = (provider: string, externalId: string) => `${provider}:${externalId}`.toUpperCase();

  // --- Mensagens automáticas (e-mail / WhatsApp de fluxos e campanhas) ---
  const shownDeliveries = deliveries.filter(
    (d) => (MESSAGE_SENT.has(d.status) && (d.sentAt || d.deliveredAt)) || MESSAGE_FAILED.has(d.status),
  );
  const deliveryWamids = new Set(
    shownDeliveries.filter((d) => d.channel === "WHATSAPP" && d.providerMessageId).map((d) => d.providerMessageId!),
  );
  /** Pedido → mensagem que levou à compra (anotada no próprio pedido). */
  const conversionByOrder = new Map<string, string>();
  const channelName = (ch: string) => (ch === "EMAIL" ? "e-mail" : "WhatsApp");

  for (const d of shownDeliveries) {
    const at = d.sentAt ?? d.deliveredAt ?? d.failedAt ?? d.bouncedAt ?? d.createdAt;
    const origin = d.flowId
      ? flowName.get(d.flowId)
        ? `Fluxo ${flowName.get(d.flowId)}`
        : null
      : d.campaignId
        ? campaignName.get(d.campaignId)
          ? `Campanha ${campaignName.get(d.campaignId)}`
          : null
        : "Envio avulso";
    const sourceName = (d.flowId && flowName.get(d.flowId)) || (d.campaignId && campaignName.get(d.campaignId)) || null;
    const name = d.subject?.trim() || sourceName || d.templateName || null;
    const channel = d.channel === "EMAIL" ? "E-mail" : "WhatsApp";
    const failed = MESSAGE_FAILED.has(d.status) && !d.deliveredAt;

    const trail: string[] = [];
    if (d.deliveredAt) trail.push(`entregue ${clock(d.deliveredAt, at)}`);
    if (d.openedAt) trail.push(`${d.channel === "WHATSAPP" ? "lido" : "aberto"} ${clock(d.openedAt, at)}`);
    if (d.clickedAt) trail.push(`clicou ${clock(d.clickedAt, at)}`);
    if (d.complainedAt) trail.push("marcou como spam");

    const failure = failed
      ? d.status === "BOUNCED"
        ? "endereço inválido"
        : d.error?.slice(0, 120) || null
      : null;

    items.push({
      at: at.toISOString(),
      type: d.channel === "EMAIL" ? "message.email" : "message.whatsapp",
      title: `${channel}${failed ? " não entregue" : ""}${name ? ` · ${name}` : ""}`,
      detail:
        [
          name === sourceName ? null : origin,
          trail.join(" · ") || null,
          d.couponCode ? `cupom ${d.couponCode}` : null,
          failure,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      meta: { deliveryId: d.id, status: d.status, flowId: d.flowId, campaignId: d.campaignId },
    });

    if (d.convertedAt && d.convertedOrderRef) {
      const label = name ? `${channelName(d.channel)} «${name}»` : `o ${channelName(d.channel)}`;
      const note =
        d.conversionKind === "ATTRIBUTED"
          ? `Comprou pelo ${label}`
          : `Recebeu o ${label} antes de comprar`;
      const key = d.convertedOrderRef.toUpperCase();
      if (!conversionByOrder.has(key) || d.conversionKind === "ATTRIBUTED") conversionByOrder.set(key, note);
    }
  }

  // --- Fluxos: entrada e saída ---
  for (const e of enrollments) {
    const name = e.flow.name;
    items.push({
      at: e.createdAt.toISOString(),
      type: "flow.enrolled",
      title: `Entrou no fluxo ${name}`,
      detail: e.holdout ? "Grupo de controle: não recebe mensagens" : undefined,
      meta: { enrollmentId: e.id, flowId: e.flowId },
    });
    if (e.status === "CONVERTED") {
      items.push({
        at: (e.convertedAt ?? e.updatedAt).toISOString(),
        type: "flow.converted",
        title: `Saiu do fluxo ${name} · comprou`,
        detail: e.convertedCents ? brl(e.convertedCents) : undefined,
        meta: { enrollmentId: e.id },
      });
    } else if (e.status === "EXITED") {
      items.push({
        at: e.updatedAt.toISOString(),
        type: "flow.exited",
        title: `Saiu do fluxo ${name}`,
        detail: e.exitReason ? FLOW_EXIT_REASONS[e.exitReason] ?? e.exitReason : undefined,
        meta: { enrollmentId: e.id },
      });
    } else if (e.status === "COMPLETED") {
      items.push({
        at: e.updatedAt.toISOString(),
        type: "flow.completed",
        title: `Concluiu o fluxo ${name}`,
        meta: { enrollmentId: e.id },
      });
    }
  }

  // --- Contato e CRM ---
  const leadCreatedTimes = leads.map((l) => l.createdAt.getTime());
  if (!leadCreatedTimes.some((t) => Math.abs(t - contact.createdAt.getTime()) < 2 * 60_000)) {
    items.push({
      at: contact.createdAt.toISOString(),
      type: "contact.created",
      title: "Contato criado",
      detail: [contact.email, contact.phone].filter(Boolean).join(" · ") || undefined,
    });
  }

  const paidOrderMoments = [
    ...marketplaceOrders
      .filter((mo) => isRevenueOrder(mo.status))
      .map((mo) => ({ at: mo.occurredAt ?? mo.createdAt, ref: `#${mo.externalId}` })),
    ...orders
      .filter((o) => o.status === "APPROVED")
      .map((o) => ({ at: o.approvedAt ?? o.createdAt, ref: null as string | null })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  for (const lead of leads) {
    const meta = asMeta(lead.metadata);
    const attrDetail = formatAttributionDetail(meta);
    const sourcePart = lead.source ? `Origem: ${leadSourceLabel(lead.source)}` : undefined;

    items.push({
      at: lead.createdAt.toISOString(),
      type: "lead.created",
      title: "Entrou no CRM",
      detail: [sourcePart, attrDetail].filter(Boolean).join(" · ") || undefined,
      href: `/crm/leads/${lead.id}`,
      meta: {
        leadId: lead.id,
        status: lead.status,
        pageSlug: meta.pageSlug,
        formId: meta.formId,
        formSlug: meta.formSlug,
        formName: meta.formName,
      },
    });

    if (typeof meta.formId === "string" && meta.formId) {
      const formLabel =
        (typeof meta.formName === "string" && meta.formName) ||
        (typeof meta.formSlug === "string" && meta.formSlug) ||
        "Formulário";
      items.push({
        at: typeof meta.convertedAt === "string" ? meta.convertedAt : lead.createdAt.toISOString(),
        type: "form.completed",
        title: `Formulário · ${formLabel}`,
        detail: attrDetail,
        href: `/crm/leads/${lead.id}`,
        meta: { leadId: lead.id, formId: meta.formId, formSlug: meta.formSlug, pageSlug: meta.pageSlug },
      });
    }

    const history = readStageHistory(meta);
    for (const h of history) {
      items.push({
        at: h.at,
        type: h.role === "WON" ? "lead.won" : h.role === "LOST" ? "lead.lost" : "lead.stage",
        title: `Movido para ${h.stage ?? "sem etapa"}`,
        detail: [h.by === "auto" ? "automático" : null, h.reason ?? null].filter(Boolean).join(" · ") || undefined,
        meta: { leadId: lead.id, stageId: h.stageId },
      });
    }

    const wonStageName = lead.stage?.role === "WON" ? lead.stage.name : "Ganho";
    if ((lead.status === "WON" || lead.stage?.role === "WON") && !history.some((h) => h.role === "WON")) {
      const fromOrder = paidOrderMoments.find((p) => p.at.getTime() >= lead.createdAt.getTime() - 60_000);
      items.push({
        at: (fromOrder?.at ?? lead.updatedAt).toISOString(),
        type: "lead.won",
        title: `Movido para ${wonStageName}`,
        detail: fromOrder ? `automático · compra${fromOrder.ref ? ` ${fromOrder.ref}` : ""}` : undefined,
        meta: { leadId: lead.id },
      });
    }

    if (lead.status === "LOST" && typeof meta.lostAt === "string" && !history.some((h) => h.role === "LOST")) {
      const reason = typeof meta.lostReason === "string" ? meta.lostReason : null;
      items.push({
        at: meta.lostAt,
        type: "lead.lost",
        title: `Movido para ${lead.stage?.name ?? "Perdido"}`,
        detail:
          ["automático", reason ? LOST_REASON_LABELS[reason as LostReason] ?? reason : null]
            .filter(Boolean)
            .join(" · ") || undefined,
        meta: { leadId: lead.id },
      });
    }
  }

  // Atribuição do lead mais recente com form/LP (para anexar em compra/finance)
  const attributionFromLeads = (() => {
    for (let i = leads.length - 1; i >= 0; i--) {
      const m = asMeta(leads[i].metadata);
      if (m.pageSlug || m.formId || m.formSlug) return m;
    }
    return null;
  })();
  const leadAttrDetail = formatAttributionDetail(attributionFromLeads ?? undefined);

  // --- WhatsApp (inbox): mensagens seguidas no mesmo sentido viram um item ---
  const outboundTimes: number[] = [];
  for (const conv of conversations) {
    const messages = conv.messages
      .filter((m) => !(m.wamid && deliveryWamids.has(m.wamid)))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (!messages.length && !conv.messages.length) {
      items.push({
        at: (conv.createdAt ?? conv.lastMessageAt ?? new Date()).toISOString(),
        type: "whatsapp.conversation",
        title: "Conversa no WhatsApp",
        href: "/whatsapp",
        meta: { conversationId: conv.id },
      });
      continue;
    }
    let group: { at: Date; last: Date; inbound: boolean; texts: string[] } | null = null;
    const flush = () => {
      if (!group) return;
      items.push({
        at: group.at.toISOString(),
        type: group.inbound ? "whatsapp.inbound" : "whatsapp.outbound",
        title: group.inbound
          ? group.texts.length > 1
            ? `Cliente enviou ${group.texts.length} mensagens`
            : "Cliente enviou mensagem"
          : group.texts.length > 1
            ? `${group.texts.length} mensagens enviadas no WhatsApp`
            : "Mensagem enviada no WhatsApp",
        detail: group.texts.join(" / ").slice(0, 220) || undefined,
        href: "/whatsapp",
        meta: { conversationId: conv.id },
      });
      group = null;
    };
    for (const m of messages) {
      const inbound = m.direction === "INBOUND";
      if (!inbound) outboundTimes.push(m.createdAt.getTime());
      const text =
        m.body?.trim() ||
        (m.templateName ? `Modelo ${m.templateName}` : WA_MEDIA[m.type] ?? null) ||
        "";
      if (group && group.inbound === inbound && m.createdAt.getTime() - group.last.getTime() < 10 * 60_000) {
        if (text) group.texts.push(text);
        group.last = m.createdAt;
        continue;
      }
      flush();
      group = { at: m.createdAt, last: m.createdAt, inbound, texts: text ? [text] : [] };
    }
    flush();
  }

  // --- Carrinhos: pedido não pago já aparece como pedido; aqui só checkout e recuperação ---
  const shownOrderKeys = new Set(marketplaceOrders.map((mo) => orderKey(mo.provider, mo.externalId)));
  const recoveredByOrder = new Map<string, true>();
  const waSentTimes = [
    ...outboundTimes,
    ...shownDeliveries.filter((d) => d.channel === "WHATSAPP").map((d) => (d.sentAt ?? d.createdAt).getTime()),
  ];

  for (const cart of carts) {
    const orderId = cart.kind === "order" ? cart.externalId.replace(/^order:/, "") : null;
    const linkedShown = orderId ? shownOrderKeys.has(orderKey(cart.provider, orderId)) : false;
    const cartItems = Array.isArray(cart.items) ? (cart.items as Array<{ title: string; quantity?: number }>) : [];

    if (!linkedShown) {
      items.push({
        at: cart.abandonedAt.toISOString(),
        type: "cart.abandoned",
        title: orderId
          ? `Pedido #${orderId} não pago · ${brl(cart.totalCents)}`
          : `Abandonou o carrinho · ${brl(cart.totalCents)}`,
        detail: [storeProviderLabel(cart.provider), itemsSummary(cartItems)].filter(Boolean).join(" · ") || undefined,
      });
    }

    if (cart.notifiedAt) {
      const t = cart.notifiedAt.getTime();
      if (!waSentTimes.some((s) => Math.abs(s - t) < 10 * 60_000)) {
        items.push({
          at: cart.notifiedAt.toISOString(),
          type: "cart.notified",
          title: "WhatsApp de recuperação enviado",
        });
      }
    }

    if (cart.status === "RECOVERED" && cart.recoveredAt) {
      const ref = cart.recoveredOrderId?.toUpperCase();
      if (ref && shownOrderKeys.has(ref)) {
        recoveredByOrder.set(ref, true);
      } else {
        items.push({
          at: cart.recoveredAt.toISOString(),
          type: "cart.recovered",
          title: `Carrinho recuperado · ${brl(cart.recoveredCents ?? cart.totalCents)}`,
        });
      }
    }
  }

  // --- Pedidos ---
  for (const order of orders) {
    const utm = [order.utmSource, order.utmMedium, order.utmCampaign].filter(Boolean).join("/");
    const approved = order.status === "APPROVED";
    const conversion = approved ? conversionByOrder.get(`COMMERCE:${order.id}`.toUpperCase()) : undefined;
    items.push({
      at: (approved ? order.approvedAt ?? order.createdAt : order.createdAt).toISOString(),
      type: approved ? "commerce.purchase" : "commerce.order",
      title: approved
        ? `Compra · ${brl(order.totalCents)}`
        : `Pedido ${orderStatusLabel(order.status)?.toLowerCase() ?? ""} · ${brl(order.totalCents)}`,
      detail:
        [
          "Checkout próprio",
          itemsSummary(order.items.map((i) => ({ title: i.name, quantity: i.quantity }))),
          conversion ?? null,
          utm || leadAttrDetail || null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      href: order.productId ? `/checkout/${order.productId}` : undefined,
      meta: {
        orderId: order.id,
        status: order.status,
        parentOrderId: order.parentOrderId,
        repurchase: Boolean(order.parentOrderId),
        pageSlug: attributionFromLeads?.pageSlug,
        formId: attributionFromLeads?.formId,
        formName: attributionFromLeads?.formName,
      },
    });
  }

  for (const mo of marketplaceOrders) {
    const cents = mo.totalCents ?? 0;
    const key = orderKey(mo.provider, mo.externalId);
    const at = mo.occurredAt ?? mo.createdAt;
    const details = orderDetails(mo.provider, {
      ...(mo.rawPayload && typeof mo.rawPayload === "object" ? (mo.rawPayload as Record<string, unknown>) : {}),
      shippingMode: mo.shippingMode,
      logisticType: mo.logisticType,
      shippingStatus: mo.shippingStatus,
      cityName: mo.cityName,
      cityRaw: mo.cityRaw,
      stateUf: mo.stateUf,
    });
    const createdAt = details?.createdAt ? new Date(details.createdAt) : null;
    const paid = isRevenueOrder(mo.status);
    const paidLater = paid && createdAt && at.getTime() - createdAt.getTime() >= 60_000 ? createdAt : null;
    const method = details?.paymentMethod ?? null;
    const place =
      formatLocation(details?.location) ??
      (mo.cityName || mo.cityRaw ? [mo.cityName ?? mo.cityRaw, mo.stateUf].filter(Boolean).join("/") : null);
    const ship =
      details?.shipping?.method ??
      mlShippingLabel(mo.shippingMode, mo.logisticType);
    if (paidLater) {
      items.push({
        at: paidLater.toISOString(),
        type: "marketplace.order.placed",
        title: `Fez o pedido #${mo.externalId} · ${brl(cents)}`,
        detail: [storeProviderLabel(mo.provider), method ? `escolheu ${method}` : null].filter(Boolean).join(" · "),
        href: mo.leadId ? `/crm/leads/${mo.leadId}` : undefined,
        meta: { provider: mo.provider, externalId: mo.externalId, orderId: mo.id, leadId: mo.leadId },
      });
    }
    const s = mo.source;
    const origin =
      s && s.channel !== "unknown"
        ? describeOrderOrigin({
            channel: s.channel,
            channelLabel: CHANNEL_LABELS[s.channel as OrderChannel] ?? s.channel,
            storeSource: s.storeSource,
            storeMedium: s.storeMedium,
            storeContent: s.storeContent,
            adMethod: s.adMethod,
            adConfidence: s.adConfidence,
            adWindow: s.adWindow,
            campaignName: s.metaCampaignName,
            adsetName: s.metaAdsetName,
            adName: s.metaAdName,
          })
        : null;
    items.push({
      at: at.toISOString(),
      type: "marketplace.order",
      title: orderTitle(mo.externalId, mo.status, cents),
      detail:
        [
          itemsSummary(mo.items),
          place ? `entrega em ${place}` : null,
          ship,
          storeProviderLabel(mo.provider),
          paid && method ? `pago com ${method}${paidLater ? ` ${fmtLag(at.getTime() - paidLater.getTime())} depois do pedido` : ""}` : null,
          origin ? `Origem: ${origin.title}` : null,
          origin?.detail,
          isRevenueOrder(mo.status) ? conversionByOrder.get(key) ?? null : null,
          recoveredByOrder.has(key) && isRevenueOrder(mo.status) ? "pago depois de ficar pendente" : null,
          origin ? null : leadAttrDetail,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      href: mo.leadId ? `/crm/leads/${mo.leadId}` : undefined,
      meta: {
        provider: mo.provider,
        externalId: mo.externalId,
        orderId: mo.id,
        leadId: mo.leadId,
      },
    });
  }

  const shownOrderRefs = new Set<string>([
    ...orders.map((o) => o.id),
    ...marketplaceOrders.flatMap((mo) => [mo.id, mo.externalId]),
  ]);
  const shownOrderTags = marketplaceOrders.map((mo) => `#${mo.externalId}`);

  for (const entry of ledger) {
    if (entry.sourceRef && shownOrderRefs.has(entry.sourceRef)) continue;
    if (entry.description && shownOrderTags.some((tag) => entry.description!.endsWith(tag))) continue;
    const entryMeta = asMeta(entry.metadata);
    const entryAttr = formatAttributionDetail(entryMeta) || leadAttrDetail;
    items.push({
      at: entry.occurredAt.toISOString(),
      type: "finance.income",
      title: `Entrada no caixa · ${brl(Math.round(Number(entry.amount) * 100))}`,
      detail: [entry.description || entry.source, entryAttr].filter(Boolean).join(" · ") || undefined,
      href: "/finance",
      meta: {
        ledgerId: entry.id,
        leadId: entry.leadId,
        sourceRef: entry.sourceRef,
        pageSlug: entryMeta.pageSlug,
        formId: entryMeta.formId,
        formName: entryMeta.formName,
      },
    });
  }

  for (const b of bookings) {
    items.push({
      at: b.createdAt.toISOString(),
      type: "agenda.booking",
      title: `Agendou · ${b.service?.title || "Reserva"}`,
      detail: `${BOOKING_STATUS[b.status] ?? b.status} · para ${clock(b.startAt, new Date(0))}`,
      href: "/agenda",
    });
  }

  items.sort(
    (a, b) =>
      new Date(a.at).getTime() - new Date(b.at).getTime() ||
      (TYPE_ORDER[a.type] ?? 5) - (TYPE_ORDER[b.type] ?? 5),
  );

  return {
    contact: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      metadata: contact.metadata,
      createdAt: contact.createdAt,
    },
    items,
  };
}
