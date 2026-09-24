/**
 * Person hub — contato canônico por workspace.
 * Dedup: phone (E.164 digits) primeiro, depois email.
 * Todo canal (form, WA, commerce, CRM) passa por aqui.
 */

import { prisma } from "@/lib/db";

export function normalizePersonPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
}

export function normalizePersonEmail(raw?: string | null): string | null {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  if (!email.includes("@") || email.length < 5) return null;
  return email.slice(0, 255);
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

/** Garante um NativeLead OPEN para o contato (não cria duplicata aberta). */
export async function ensureOpenNativeLead(input: {
  workspaceId: string;
  contactId: string;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const open = await prisma.nativeLead.findFirst({
    where: {
      clienteId: input.workspaceId,
      contactId: input.contactId,
      status: "OPEN",
    },
    include: { contact: true, stage: true },
    orderBy: { createdAt: "desc" },
  });
  if (open) {
    if (input.source || input.metadata) {
      const prev = (open.metadata as Record<string, unknown> | null) ?? {};
      const incoming = {
        ...(input.metadata ?? {}),
        ...(input.source ? { source: input.source } : {}),
      };
      return prisma.nativeLead.update({
        where: { id: open.id },
        data: {
          source: open.source || input.source || undefined,
          metadata: mergeLeadAttributionMeta(prev, incoming) as never,
        },
        include: { contact: true, stage: true },
      });
    }
    return open;
  }

  const pipeline = await ensurePipeline(input.workspaceId);
  const stages = pipeline.stages as Array<{ id: string; name: string; role?: string | null }>;
  const entryStage =
    stages.find((s) => s.role === "ENTRY") ??
    stages.find((s) => /^novo$/i.test(s.name)) ??
    stages[0];
  return prisma.nativeLead.create({
    data: {
      clienteId: input.workspaceId,
      contactId: input.contactId,
      stageId: entryStage?.id,
      source: input.source ?? "inbound",
      status: "OPEN",
      metadata: input.metadata ?? undefined,
    },
    include: { contact: true, stage: true },
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

export type JourneyItem = {
  at: string;
  type: string;
  title: string;
  detail?: string;
  href?: string;
  meta?: Record<string, unknown>;
};

/** Timeline unificada da pessoa (CRM / WA / Commerce / Agenda). */
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

  const [leads, conversations, orders, bookings, marketplaceOrders] = await Promise.all([
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
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
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
      include: { items: { take: 10 } },
      orderBy: { occurredAt: "asc" },
      take: 50,
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

  const items: JourneyItem[] = [];

  items.push({
    at: contact.createdAt.toISOString(),
    type: "contact.created",
    title: "Contato na base",
    detail: [contact.email, contact.phone].filter(Boolean).join(" · ") || undefined,
  });

  for (const lead of leads) {
    const meta =
      lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
        ? (lead.metadata as Record<string, unknown>)
        : {};
    const attrDetail = formatAttributionDetail(meta);
    const sourcePart = lead.source ? `Fonte: ${lead.source}` : undefined;
    const leadDetail = [sourcePart, attrDetail].filter(Boolean).join(" · ") || undefined;

    items.push({
      at: lead.createdAt.toISOString(),
      type: "lead.created",
      title: `Lead · ${lead.stage?.name || lead.status}`,
      detail: leadDetail,
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
      const formAt =
        typeof meta.convertedAt === "string"
          ? meta.convertedAt
          : lead.createdAt.toISOString();
      const formLabel =
        (typeof meta.formName === "string" && meta.formName) ||
        (typeof meta.formSlug === "string" && meta.formSlug) ||
        "Formulário";
      items.push({
        at: formAt,
        type: "form.completed",
        title: `Formulário · ${formLabel}`,
        detail: attrDetail,
        href: `/crm/leads/${lead.id}`,
        meta: {
          leadId: lead.id,
          formId: meta.formId,
          formSlug: meta.formSlug,
          pageSlug: meta.pageSlug,
        },
      });
    }

    if (lead.status === "WON" || lead.stage?.role === "WON") {
      const wonAt = lead.updatedAt?.toISOString() || lead.createdAt.toISOString();
      const deal =
        lead.dealValue != null ? Number(lead.dealValue) : null;
      items.push({
        at: wonAt,
        type: "lead.won",
        title: deal != null ? `Ganho · R$ ${deal.toFixed(2)}` : "Ganho no CRM",
        detail: leadDetail,
        href: `/crm/leads/${lead.id}`,
        meta: {
          leadId: lead.id,
          dealValue: deal,
          pageSlug: meta.pageSlug,
          formId: meta.formId,
          formName: meta.formName,
        },
      });
    }
  }

  // Atribuição do lead mais recente com form/LP (para anexar em compra/finance)
  const attributionFromLeads = (() => {
    for (let i = leads.length - 1; i >= 0; i--) {
      const m =
        leads[i].metadata &&
        typeof leads[i].metadata === "object" &&
        !Array.isArray(leads[i].metadata)
          ? (leads[i].metadata as Record<string, unknown>)
          : null;
      if (m && (m.pageSlug || m.formId || m.formSlug)) return m;
    }
    return null;
  })();
  const leadAttrDetail = formatAttributionDetail(attributionFromLeads ?? undefined);

  for (const conv of conversations) {
    items.push({
      at: (conv.createdAt ?? conv.lastMessageAt ?? new Date()).toISOString(),
      type: "whatsapp.conversation",
      title: `WhatsApp · ${conv.status}`,
      detail: conv.phone,
      href: "/whatsapp",
      meta: { conversationId: conv.id },
    });
    for (const m of conv.messages) {
      items.push({
        at: m.createdAt.toISOString(),
        type: m.direction === "INBOUND" ? "whatsapp.inbound" : "whatsapp.outbound",
        title: m.direction === "INBOUND" ? "WA recebido" : "WA enviado",
        detail: (m.body || m.type || "").slice(0, 120),
      });
    }
  }

  for (const order of orders) {
    const utm = [order.utmSource, order.utmMedium, order.utmCampaign].filter(Boolean).join("/");
    items.push({
      at: order.createdAt.toISOString(),
      type: order.status === "APPROVED" ? "commerce.purchase" : "commerce.order",
      title:
        order.status === "APPROVED"
          ? `Compra · R$ ${(order.totalCents / 100).toFixed(2)}`
          : `Pedido ${order.status} · R$ ${(order.totalCents / 100).toFixed(2)}`,
      detail:
        [order.items.map((i) => i.name).join(", "), leadAttrDetail, utm || null]
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
    if (order.approvedAt) {
      items.push({
        at: order.approvedAt.toISOString(),
        type: "commerce.approved",
        title: "Pagamento aprovado",
        detail: [order.id, leadAttrDetail].filter(Boolean).join(" · ") || undefined,
      });
    }
  }

  for (const mo of marketplaceOrders) {
    const cents = mo.totalCents ?? 0;
    const providerLabel =
      mo.provider === "SHOPIFY"
        ? "Shopify"
        : mo.provider === "WOOCOMMERCE"
          ? "WooCommerce"
          : mo.provider === "MERCADO_LIVRE"
            ? "Mercado Livre"
            : mo.provider;
    items.push({
      at: (mo.occurredAt ?? mo.createdAt).toISOString(),
      type: "marketplace.order",
      title: `${providerLabel} · R$ ${(cents / 100).toFixed(2)}`,
      detail:
        [
          mo.items.map((i) => i.title).join(", ") || null,
          mo.status,
          leadAttrDetail,
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

  for (const entry of ledger) {
    const entryMeta =
      entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
        ? (entry.metadata as Record<string, unknown>)
        : {};
    const entryAttr =
      formatAttributionDetail(entryMeta) || leadAttrDetail;
    items.push({
      at: entry.occurredAt.toISOString(),
      type: "finance.income",
      title: `Entrada · R$ ${Number(entry.amount).toFixed(2)}`,
      detail: [entry.description || entry.source, entryAttr]
        .filter(Boolean)
        .join(" · ") || undefined,
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
      title: `Agenda · ${b.service?.title || "Reserva"}`,
      detail: `${b.status} · ${b.startAt.toLocaleString("pt-BR")}`,
      href: "/agenda",
    });
  }

  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

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
