/**
 * Campanhas (avulsas e sazonais): público, produção com aprovação, checklist, estimativa de custo,
 * disparo em lotes no cron (mesmos limites e rastreio dos fluxos) e criação automática D-30.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { loadMessagingPrefs } from "@/lib/flows/prefs";
import { nextAllowedTime } from "@/lib/flows/dates";
import { emailContentProblems, sanitizeEmailContent } from "@/lib/flows/render-email";
import { isEmailContent, type EmailContent, type WhatsAppContent } from "@/lib/flows/types";
import { prepareEmail, sendEmailBatch, sendWhatsAppMessage, type PreparedEmail, type SendContact } from "@/lib/flows/send";
import { resendReady, resolveResend, warmupDailyCap } from "@/lib/integrations/resend/connection";
import { waCapacity, waRateFor } from "@/lib/flows/wa-limits";
import { upcomingDates } from "@/lib/flows/calendar";
import { notify } from "@/lib/notifications";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const LEASE_MS = 10 * 60_000;

export const CAMPAIGN_STATUSES = [
  "IDEIA",
  "BRIEFING",
  "CRIACAO",
  "REVISAO",
  "APROVADA",
  "AGENDADA",
  "ENVIANDO",
  "ENVIADA",
  "PERDIDA",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  IDEIA: "Ideia",
  BRIEFING: "Briefing",
  CRIACAO: "Copy e criação",
  REVISAO: "Revisão",
  APROVADA: "Aprovada",
  AGENDADA: "Agendada",
  ENVIANDO: "Enviando",
  ENVIADA: "Enviada",
  PERDIDA: "Perdida",
};

export type CampaignAudience = {
  lifecycles?: string[];
  productTitles?: string[];
  minSpentCents?: number | null;
  maxSpentCents?: number | null;
  inactiveDays?: number | null;
  birthdayMonth?: number | null;
  consentOnly?: boolean;
  /** Não enviar a quem recebeu campanha nos últimos N dias */
  excludeRecentDays?: number | null;
  excludeCustomers?: boolean;
};

export type CampaignContent = { email?: EmailContent; whatsapp?: WhatsAppContent };

export type CampaignBriefing = {
  objective?: string;
  offer?: string;
  audienceNote?: string;
  products?: string[];
  tone?: string;
  channels?: string[];
  references?: string;
  suggestedSendAt?: string;
};

export function parseAudience(raw: unknown): CampaignAudience {
  return (raw && typeof raw === "object" ? raw : {}) as CampaignAudience;
}
export function parseContent(raw: unknown): CampaignContent {
  return (raw && typeof raw === "object" ? raw : {}) as CampaignContent;
}

export function campaignSlug(c: { id: string; calendarKey: string | null; name: string }) {
  if (c.calendarKey) return c.calendarKey;
  const base = c.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "campanha"}-${c.id.slice(-5)}`;
}

const wantsEmail = (channel: string) => channel === "EMAIL" || channel === "BOTH";
const wantsWa = (channel: string) => channel === "WHATSAPP" || channel === "BOTH";

// --------------------------------------------------------------------------- público

function audienceWhere(workspaceId: string, a: CampaignAudience): Prisma.NativeContactWhereInput {
  const and: Prisma.NativeContactWhereInput[] = [{ clienteId: workspaceId }];
  if (a.lifecycles?.length) {
    const withProfile = a.lifecycles.filter((l) => l !== "LEAD");
    and.push({
      OR: [
        ...(withProfile.length ? [{ profile: { lifecycle: { in: withProfile } } }] : []),
        ...(a.lifecycles.includes("LEAD") ? [{ profile: null }, { profile: { lifecycle: "LEAD" } }] : []),
      ],
    });
  }
  if (a.minSpentCents != null || a.maxSpentCents != null) {
    and.push({
      profile: {
        totalSpentCents: {
          ...(a.minSpentCents != null ? { gte: a.minSpentCents } : {}),
          ...(a.maxSpentCents != null ? { lte: a.maxSpentCents } : {}),
        },
      },
    });
  }
  if (a.inactiveDays) {
    and.push({ profile: { lastOrderAt: { lt: new Date(Date.now() - a.inactiveDays * DAY) } } });
  }
  if (a.excludeCustomers) {
    and.push({ OR: [{ profile: null }, { profile: { ordersCount: 0 } }] });
  }
  if (a.productTitles?.length) {
    and.push({
      OR: a.productTitles.map((t) => ({
        marketplaceOrders: { some: { items: { some: { title: { contains: t, mode: "insensitive" as const } } } } },
      })),
    });
  }
  if (a.birthdayMonth) {
    and.push({ importantDates: { some: { kind: "BIRTHDAY", month: a.birthdayMonth } } });
  }
  if (a.consentOnly) and.push({ marketingConsentAt: { not: null } });
  return { AND: and };
}

const EMAIL_OK: Prisma.NativeContactWhereInput = {
  email: { not: null },
  emailOptOutAt: null,
  emailBouncedAt: null,
  emailComplainedAt: null,
};
const WA_OK: Prisma.NativeContactWhereInput = {
  OR: [{ phone: { not: null } }, { phoneE164: { not: null } }],
  waOptOutAt: null,
  waMarketingOptOutAt: null,
};

async function recentlyCampaignedIds(workspaceId: string, days: number | null | undefined) {
  if (!days) return [];
  const rows = await prisma.messageDelivery.findMany({
    where: { clienteId: workspaceId, campaignId: { not: null }, isTest: false, createdAt: { gte: new Date(Date.now() - days * DAY) } },
    select: { contactId: true },
    distinct: ["contactId"],
  });
  return rows.map((r) => r.contactId).filter((v): v is string => Boolean(v));
}

export async function audienceCount(workspaceId: string, audience: CampaignAudience, channel: string) {
  const exclude = await recentlyCampaignedIds(workspaceId, audience.excludeRecentDays);
  const base = audienceWhere(workspaceId, audience);
  const notExcluded = exclude.length ? { id: { notIn: exclude } } : {};
  const [total, email, whatsapp] = await Promise.all([
    prisma.nativeContact.count({ where: { AND: [base, notExcluded] } }),
    wantsEmail(channel) ? prisma.nativeContact.count({ where: { AND: [base, notExcluded, EMAIL_OK] } }) : 0,
    wantsWa(channel) ? prisma.nativeContact.count({ where: { AND: [base, notExcluded, WA_OK] } }) : 0,
  ]);
  const reachable = channel === "BOTH"
    ? await prisma.nativeContact.count({ where: { AND: [base, notExcluded, { OR: [EMAIL_OK, WA_OK] }] } })
    : channel === "WHATSAPP" ? whatsapp : email;
  return { total, email, whatsapp, reachable };
}

export async function audienceSample(workspaceId: string, audience: CampaignAudience, limit = 20) {
  return prisma.nativeContact.findMany({
    where: audienceWhere(workspaceId, audience),
    select: { id: true, name: true, email: true, phone: true, profile: { select: { lifecycle: true, totalSpentCents: true } } },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });
}

// --------------------------------------------------------------------------- checklist / transições

export type ChecklistItem = { key: string; label: string; ok: boolean; detail?: string };

export async function campaignChecklist(campaign: {
  clienteId: string;
  channel: string;
  content: unknown;
  waTemplateRefId: string | null;
  couponCode: string | null;
  checklist: unknown;
  audience: unknown;
  testedAt: Date | null;
  contentUpdatedAt: Date | null;
}): Promise<ChecklistItem[]> {
  const content = parseContent(campaign.content);
  const manual = (campaign.checklist ?? {}) as { couponConfirmed?: boolean; audienceReviewed?: boolean };
  const items: ChecklistItem[] = [];
  if (wantsEmail(campaign.channel)) {
    const problems = content.email && isEmailContent(content.email) ? emailContentProblems(sanitizeEmailContent(content.email)) : ["sem conteúdo"];
    items.push({ key: "email", label: "Assunto e conteúdo do e-mail completos", ok: problems.length === 0, detail: problems.join(", ") || undefined });
  }
  if (wantsWa(campaign.channel)) {
    const tpl = campaign.waTemplateRefId
      ? await prisma.waTemplateRef.findFirst({ where: { id: campaign.waTemplateRefId, clienteId: campaign.clienteId }, select: { status: true, name: true } })
      : null;
    items.push({
      key: "wa_template",
      label: "Template de WhatsApp aprovado pela Meta",
      ok: tpl?.status === "APPROVED",
      detail: tpl ? `${tpl.name}: ${tpl.status}` : "Nenhum template escolhido",
    });
  }
  if (campaign.couponCode) {
    items.push({ key: "coupon", label: `Cupom ${campaign.couponCode} criado na loja`, ok: Boolean(manual.couponConfirmed) });
  }
  const count = await audienceCount(campaign.clienteId, parseAudience(campaign.audience), campaign.channel);
  items.push({
    key: "audience",
    label: "Público revisado",
    ok: Boolean(manual.audienceReviewed) && count.reachable > 0,
    detail: `${count.reachable} contatos alcançáveis`,
  });
  if (wantsEmail(campaign.channel)) {
    const fresh = Boolean(campaign.testedAt && (!campaign.contentUpdatedAt || campaign.testedAt >= campaign.contentUpdatedAt));
    items.push({ key: "test", label: "E-mail de teste enviado após a última edição", ok: fresh });
  }
  return items;
}

export type CampaignAction =
  | "start_briefing"
  | "start_creation"
  | "send_review"
  | "request_changes"
  | "approve"
  | "schedule"
  | "unschedule"
  | "cancel";

export type CampaignActor = { memberId: string | null; role: string | null; name: string | null; platform: boolean };

const canApprove = (a: CampaignActor) => a.platform || a.role === "OWNER" || a.role === "ADMIN";

export async function transitionCampaign(
  workspaceId: string,
  campaignId: string,
  action: CampaignAction,
  actor: CampaignActor,
  opts?: { comment?: string; scheduledAt?: string; confirmCount?: number },
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const c = await prisma.messageCampaign.findFirst({ where: { id: campaignId, clienteId: workspaceId } });
  if (!c) return { ok: false, error: "Campanha não encontrada" };
  const comment = async (kind: string, body: string) =>
    prisma.messageCampaignComment.create({
      data: { campaignId, memberId: actor.memberId, authorName: actor.name, kind, body: body.slice(0, 4000) },
    });

  let next: CampaignStatus | null = null;
  const data: Prisma.MessageCampaignUpdateInput = {};
  switch (action) {
    case "start_briefing":
      if (!["IDEIA", "PERDIDA"].includes(c.status)) return { ok: false, error: "Etapa inválida" };
      next = "BRIEFING";
      break;
    case "start_creation":
      if (!["IDEIA", "BRIEFING"].includes(c.status)) return { ok: false, error: "Etapa inválida" };
      next = "CRIACAO";
      break;
    case "send_review":
      if (!["BRIEFING", "CRIACAO"].includes(c.status)) return { ok: false, error: "Etapa inválida" };
      next = "REVISAO";
      break;
    case "request_changes":
      if (!["REVISAO", "APROVADA", "AGENDADA"].includes(c.status)) return { ok: false, error: "Etapa inválida" };
      next = "CRIACAO";
      await comment("AJUSTES", opts?.comment || "Ajustes solicitados");
      break;
    case "approve": {
      // Campanha simples: Dono/Admin pode aprovar direto da criação
      if (!["REVISAO", "CRIACAO"].includes(c.status)) return { ok: false, error: "Etapa inválida" };
      if (!canApprove(actor)) return { ok: false, error: "Só Dono ou Admin aprova campanhas" };
      const list = await campaignChecklist(c);
      const pending = list.filter((i) => !i.ok);
      if (pending.length) return { ok: false, error: `Checklist pendente: ${pending.map((p) => p.label).join("; ")}` };
      next = "APROVADA";
      data.approvedAt = new Date();
      data.approvedByMemberId = actor.memberId;
      await comment("APROVACAO", opts?.comment || "Aprovada");
      break;
    }
    case "schedule": {
      if (c.status !== "APROVADA") return { ok: false, error: "Aprove a campanha antes de agendar" };
      const at = opts?.scheduledAt ? new Date(opts.scheduledAt) : c.scheduledAt;
      if (!at || Number.isNaN(at.getTime())) return { ok: false, error: "Defina data e hora do envio" };
      const count = await audienceCount(workspaceId, parseAudience(c.audience), c.channel);
      if (opts?.confirmCount !== count.reachable) {
        return { ok: false, error: `Confirme digitando o total de destinatários (${count.reachable})` };
      }
      next = "AGENDADA";
      data.scheduledAt = at;
      data.recipientsCount = count.reachable;
      break;
    }
    case "unschedule":
      if (c.status !== "AGENDADA") return { ok: false, error: "Campanha não está agendada" };
      next = "APROVADA";
      break;
    case "cancel":
      if (["ENVIANDO", "ENVIADA"].includes(c.status)) return { ok: false, error: "Campanha já saiu" };
      next = "PERDIDA";
      await comment("SISTEMA", opts?.comment || "Campanha cancelada");
      break;
  }
  if (!next) return { ok: false, error: "Ação inválida" };
  await prisma.messageCampaign.update({ where: { id: c.id }, data: { ...data, status: next } });
  if (next === "REVISAO" && c.approverMemberId) {
    await notify({
      clienteId: workspaceId,
      memberId: c.approverMemberId,
      type: "campaign.review",
      title: `Campanha "${c.name}" aguardando sua revisão`,
      href: `/relacionamento/campanhas/${c.id}`,
      severity: "aviso",
      dedupeKey: `campaign:${c.id}:review:${Date.now().toString().slice(0, -5)}`,
    });
  }
  return { ok: true, status: next };
}

/** Edição de conteúdo depois de aprovada volta para Revisão. */
export async function touchCampaignContent(campaignId: string) {
  const c = await prisma.messageCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  await prisma.messageCampaign.update({
    where: { id: campaignId },
    data: {
      contentUpdatedAt: new Date(),
      ...(c && ["APROVADA", "AGENDADA"].includes(c.status) ? { status: "REVISAO", approvedAt: null } : {}),
    },
  });
}

// --------------------------------------------------------------------------- estimativa

export async function estimateCampaign(workspaceId: string, campaign: { channel: string; audience: unknown }) {
  const count = await audienceCount(workspaceId, parseAudience(campaign.audience), campaign.channel);
  const rate = await waRateFor("marketing");
  const waCost = wantsWa(campaign.channel) && rate ? Math.round((count.whatsapp * rate.priceMicros) / 10_000) : 0;
  const { prefs } = await loadMessagingPrefs(workspaceId);
  const capacity = wantsWa(campaign.channel) ? await waCapacity(workspaceId, prefs.waAutoReservePercent) : null;
  const conn = await resolveResend(workspaceId);
  const warmup = conn ? warmupDailyCap(conn.domainVerifiedAt) : null;
  const emailDays = warmup && count.email > 0 ? Math.ceil(count.email / warmup) : 1;
  const waDays =
    capacity && capacity.campaignLeft != null && capacity.campaignLeft > 0
      ? Math.ceil(count.whatsapp / capacity.campaignLeft)
      : capacity && capacity.campaignLeft === 0 && count.whatsapp > 0
        ? null
        : 1;
  return {
    ...count,
    waCostCents: waCost,
    waRateMicros: rate?.priceMicros ?? null,
    currency: rate?.currency ?? "BRL",
    waCapacity: capacity,
    emailWarmupCap: warmup,
    emailDays,
    waDays,
  };
}

// --------------------------------------------------------------------------- disparo

async function materializeRecipients(c: { id: string; clienteId: string; audience: unknown; channel: string }) {
  const audience = parseAudience(c.audience);
  const exclude = await recentlyCampaignedIds(c.clienteId, audience.excludeRecentDays);
  const reach: Prisma.NativeContactWhereInput =
    c.channel === "BOTH" ? { OR: [EMAIL_OK, WA_OK] } : c.channel === "WHATSAPP" ? WA_OK : EMAIL_OK;
  let cursor: string | undefined;
  let total = 0;
  for (;;) {
    const rows = await prisma.nativeContact.findMany({
      where: { AND: [audienceWhere(c.clienteId, audience), reach, ...(exclude.length ? [{ id: { notIn: exclude } }] : [])] },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 2000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    await prisma.messageCampaignRecipient.createMany({
      data: rows.map((r) => ({ campaignId: c.id, contactId: r.id })),
      skipDuplicates: true,
    });
    total += rows.length;
    cursor = rows[rows.length - 1].id;
    if (rows.length < 2000) break;
  }
  return total;
}

async function claimRecipients(campaignId: string, limit: number, now: Date) {
  const lease = new Date(now.getTime() + LEASE_MS);
  return prisma.$queryRaw<Array<{ id: string; contactId: string }>>`
    UPDATE "MessageCampaignRecipient" AS r
    SET status = 'SENDING', "leaseUntil" = ${lease}
    WHERE r.id IN (
      SELECT r2.id FROM "MessageCampaignRecipient" r2
      WHERE r2."campaignId" = ${campaignId}
        AND (r2.status = 'PENDING' OR (r2.status = 'SENDING' AND r2."leaseUntil" < ${now}))
      ORDER BY r2.id
      LIMIT ${limit}
      FOR UPDATE OF r2 SKIP LOCKED
    )
    RETURNING r.id, r."contactId"`;
}

async function campaignEmailsToday(workspaceId: string) {
  return prisma.messageDelivery.count({
    where: {
      clienteId: workspaceId,
      channel: "EMAIL",
      campaignId: { not: null },
      isTest: false,
      createdAt: { gte: new Date(Date.now() - DAY) },
    },
  });
}

async function emailsLast24h(contactIds: string[]) {
  const rows = await prisma.messageDelivery.groupBy({
    by: ["contactId"],
    where: {
      contactId: { in: contactIds },
      channel: "EMAIL",
      isTest: false,
      status: { notIn: ["FAILED", "SKIPPED", "QUEUED"] },
      createdAt: { gte: new Date(Date.now() - DAY) },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.contactId as string, r._count._all]));
}

async function sendCampaignBatch(
  c: { id: string; clienteId: string; name: string; channel: string; content: unknown; couponCode: string | null; waTemplateRefId: string | null; calendarKey: string | null },
  now: Date,
) {
  const { prefs, timezone } = await loadMessagingPrefs(c.clienteId);
  const allowed = nextAllowedTime(now, timezone, prefs.sendStartHour, prefs.sendEndHour);
  if (allowed > now) return { deferredUntil: allowed, sent: 0, done: false };

  const content = parseContent(c.content);
  const slug = campaignSlug(c);
  const origin = { campaignId: c.id, campaignSlug: slug };
  let budget = 500;
  if (wantsEmail(c.channel)) {
    const conn = await resolveResend(c.clienteId);
    if (!resendReady(conn)) return { deferredUntil: new Date(now.getTime() + HOUR), sent: 0, done: false, reason: "resend_not_ready" };
    const cap = warmupDailyCap(conn.domainVerifiedAt);
    if (cap != null) {
      const left = cap - (await campaignEmailsToday(c.clienteId));
      if (left <= 0) return { deferredUntil: new Date(now.getTime() + 6 * HOUR), sent: 0, done: false, reason: "warmup_cap" };
      budget = Math.min(budget, left);
    }
  }
  const claimed = await claimRecipients(c.id, budget, now);
  if (!claimed.length) {
    const pending = await prisma.messageCampaignRecipient.count({ where: { campaignId: c.id, status: { in: ["PENDING", "SENDING"] } } });
    return { sent: 0, done: pending === 0 };
  }
  const contacts = await prisma.nativeContact.findMany({ where: { id: { in: claimed.map((r) => r.contactId) } } });
  const byId = new Map(contacts.map((x) => [x.id, x]));
  const sentToday = await emailsLast24h(contacts.map((x) => x.id));
  const results = new Map<string, { status: string; deliveryId?: string; error?: string }>();
  const toPrepare: Array<{ recipientId: string; prepared: PreparedEmail }> = [];

  for (const r of claimed) {
    const contact = byId.get(r.contactId);
    if (!contact) {
      results.set(r.id, { status: "SKIPPED", error: "contact_removed" });
      continue;
    }
    const sc: SendContact = contact;
    let any = false;
    let lastErr = "";
    const emailOk =
      wantsEmail(c.channel) && content.email && contact.email && !contact.emailOptOutAt && !contact.emailBouncedAt && !contact.emailComplainedAt;
    if (emailOk && (sentToday.get(contact.id) ?? 0) < prefs.maxEmailsPerDay) {
      const p = await prepareEmail({
        clienteId: c.clienteId,
        contact: sc,
        content: sanitizeEmailContent(content.email!),
        couponCode: c.couponCode,
        data: {},
        origin,
        idempotencyKey: `camp-${c.id}-${contact.id}`,
      });
      if ("error" in p) lastErr = p.error;
      else {
        toPrepare.push({ recipientId: r.id, prepared: p });
        any = true;
      }
    } else if (emailOk) lastErr = "frequency_limit";

    if (wantsWa(c.channel) && (contact.phoneE164 || contact.phone)) {
      const wa: WhatsAppContent = { ...(content.whatsapp ?? {}), ...(c.waTemplateRefId ? { templateRefId: c.waTemplateRefId } : {}) };
      const res = await sendWhatsAppMessage({
        clienteId: c.clienteId,
        contact: sc,
        content: wa,
        couponCode: c.couponCode,
        data: {},
        origin,
        automatic: false,
        reservePercent: prefs.waAutoReservePercent,
      });
      if (res.status === "SENT") {
        any = true;
        results.set(r.id, { status: "SENT", deliveryId: res.deliveryId });
      } else if (res.status === "DEFERRED") {
        // Limite do portfólio: volta para a fila (próxima onda)
        results.set(r.id, { status: "PENDING", error: res.reason });
        continue;
      } else lastErr = res.reason;
    }
    if (!results.has(r.id)) results.set(r.id, any ? { status: "SENT" } : { status: "SKIPPED", error: lastErr || "not_eligible" });
  }

  for (let i = 0; i < toPrepare.length; i += 100) {
    const chunk = toPrepare.slice(i, i + 100);
    const key = createHash("sha256")
      .update(`${c.id}:${chunk.map((x) => x.prepared.deliveryId).join(",")}`)
      .digest("hex")
      .slice(0, 48);
    const r = await sendEmailBatch(c.clienteId, chunk.map((x) => x.prepared), `camp-${key}`);
    for (const x of chunk) {
      const prev = results.get(x.recipientId);
      if (r.sent) results.set(x.recipientId, { status: "SENT", deliveryId: prev?.deliveryId ?? x.prepared.deliveryId });
      else if (prev?.status !== "SENT") results.set(x.recipientId, { status: "FAILED", error: r.error ?? "batch_failed" });
    }
  }

  let sent = 0;
  for (const [id, r] of results) {
    if (r.status === "SENT") sent++;
    await prisma.messageCampaignRecipient.update({
      where: { id },
      data: {
        status: r.status,
        leaseUntil: null,
        deliveryId: r.deliveryId ?? null,
        error: r.error?.slice(0, 500) ?? null,
        ...(r.status === "SENT" ? { sentAt: new Date() } : {}),
      },
    });
  }
  return { sent, done: false };
}

/** Cron (5 min): campanhas agendadas vencidas e em envio. */
export async function runDueCampaigns(now = new Date()) {
  const due = await prisma.messageCampaign.findMany({
    where: {
      OR: [{ status: "AGENDADA", scheduledAt: { lte: now } }, { status: "ENVIANDO" }],
    },
    take: 20,
  });
  const stats = { campaigns: due.length, sent: 0, finished: 0 };
  for (const c of due) {
    try {
      if (c.status === "AGENDADA") {
        // Só dispara o que foi aprovado (não há caminho para AGENDADA sem aprovação)
        if (!c.approvedAt) {
          await prisma.messageCampaign.update({ where: { id: c.id }, data: { status: "REVISAO" } });
          continue;
        }
        const total = await materializeRecipients(c);
        await prisma.messageCampaign.update({ where: { id: c.id }, data: { status: "ENVIANDO", recipientsCount: total } });
      }
      for (let round = 0; round < 6; round++) {
        const r = await sendCampaignBatch(c, now);
        stats.sent += r.sent;
        if (r.done) {
          const sentCount = await prisma.messageCampaignRecipient.count({ where: { campaignId: c.id, status: "SENT" } });
          await prisma.messageCampaign.update({ where: { id: c.id }, data: { status: "ENVIADA", sentAt: new Date() } });
          stats.finished++;
          const targets = [c.ownerMemberId, c.approverMemberId].filter((v): v is string => Boolean(v));
          for (const memberId of targets.length ? targets : [null]) {
            await notify({
              clienteId: c.clienteId,
              memberId,
              role: memberId ? null : "ADMIN",
              type: "campaign.sent",
              title: `Campanha "${c.name}" disparada para ${sentCount} contatos`,
              href: `/relacionamento/campanhas/${c.id}`,
              severity: "info",
              dedupeKey: `campaign:${c.id}:sent:${memberId ?? "all"}`,
              email: true,
            });
          }
          break;
        }
        if (r.sent === 0) break;
      }
    } catch (err) {
      console.warn("[campaigns]", c.id, err instanceof Error ? err.message : err);
    }
  }
  return stats;
}

/** Teste de campanha (e-mail e/ou WhatsApp). Grava testedAt. */
export async function sendCampaignTest(
  workspaceId: string,
  campaignId: string,
  to: { email?: string | null; phone?: string | null },
) {
  const c = await prisma.messageCampaign.findFirst({ where: { id: campaignId, clienteId: workspaceId } });
  if (!c) throw new Error("Campanha não encontrada");
  const content = parseContent(c.content);
  const contact = await sampleContact(workspaceId, to.email ?? null);
  const out: Record<string, unknown> = {};
  if (to.email && content.email) {
    const { sendEmailMessage } = await import("@/lib/flows/send");
    out.email = await sendEmailMessage({
      clienteId: workspaceId,
      contact,
      content: sanitizeEmailContent(content.email),
      couponCode: c.couponCode,
      data: {},
      origin: { campaignId: c.id, campaignSlug: campaignSlug(c) },
      idempotencyKey: `camp-test-${c.id}-${Date.now()}`,
      isTest: true,
      testTo: to.email,
    });
  }
  if (to.phone && (c.waTemplateRefId || content.whatsapp)) {
    out.whatsapp = await sendWhatsAppMessage({
      clienteId: workspaceId,
      contact,
      content: { ...(content.whatsapp ?? {}), ...(c.waTemplateRefId ? { templateRefId: c.waTemplateRefId } : {}) },
      couponCode: c.couponCode,
      data: {},
      origin: { campaignId: c.id, campaignSlug: campaignSlug(c) },
      automatic: false,
      reservePercent: 0,
      isTest: true,
      testPhone: to.phone,
    });
  }
  const emailSent = (out.email as { status?: string } | undefined)?.status === "SENT";
  if (emailSent) await prisma.messageCampaign.update({ where: { id: c.id }, data: { testedAt: new Date() } });
  return out;
}

/** Contato de exemplo para testes (nome real deixa a prévia fiel). */
export async function sampleContact(workspaceId: string, email: string | null): Promise<SendContact> {
  const c = email
    ? await prisma.nativeContact.findFirst({ where: { clienteId: workspaceId, email: email.toLowerCase() } })
    : null;
  return c ?? { id: `test-${workspaceId}`, name: "Cliente Teste", email, phone: null };
}

// --------------------------------------------------------------------------- sazonais D-30

/** Workspaces com relacionamento ativo (algum fluxo) recebem campanhas sazonais em IDEIA. */
export async function createSeasonalCampaigns(now = new Date()) {
  const workspaces = await prisma.messageFlow.findMany({ distinct: ["clienteId"], select: { clienteId: true } });
  let created = 0;
  for (const { clienteId } of workspaces) {
    const dates = await upcomingDates(clienteId, { days: 90, now });
    for (const d of dates) {
      const daysTo = Math.ceil((d.date.getTime() - now.getTime()) / DAY);
      if (daysTo > d.leadDays || daysTo < 3) continue;
      const exists = await prisma.messageCampaign.findUnique({
        where: { clienteId_calendarKey: { clienteId, calendarKey: d.key } },
        select: { id: true },
      });
      if (exists) continue;
      const lastYear = await suggestFromHistory(clienteId, d.label);
      const sendAt = new Date(d.date.getTime() - (d.key.startsWith("black-friday") ? 0 : 3 * DAY));
      sendAt.setUTCHours(13, 0, 0, 0);
      try {
        const c = await prisma.messageCampaign.create({
          data: {
            clienteId,
            name: `${d.label} ${d.date.getUTCFullYear()}`,
            channel: "EMAIL",
            status: "IDEIA",
            eventDate: d.date,
            calendarKey: d.key,
            scheduledAt: sendAt,
            audience: { lifecycles: ["NOVO", "RECORRENTE", "VIP", "EM_RISCO"] } as Prisma.InputJsonValue,
            briefing: {
              objective: `Vendas de ${d.label}`,
              offer: lastYear.offer ?? "",
              audienceNote: "Clientes novos, recorrentes, VIP e em risco",
              products: lastYear.products,
              tone: "",
              channels: ["EMAIL"],
              references: d.hint ?? "",
              suggestedSendAt: sendAt.toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
        await prisma.messageCampaignComment.create({
          data: { campaignId: c.id, kind: "SISTEMA", body: `Criada automaticamente ${daysTo} dias antes de ${d.label}.` },
        });
        await notify({
          clienteId,
          role: "ADMIN",
          type: "campaign.created",
          title: `Campanha de ${d.label} criada: preencha o briefing`,
          body: `Faltam ${daysTo} dias. Defina oferta, público e responsáveis.`,
          href: `/relacionamento/campanhas/${c.id}`,
          severity: "info",
          dedupeKey: `campaign:${c.id}:D-30`,
          email: true,
        });
        created++;
      } catch (err) {
        if ((err as { code?: string }).code !== "P2002") throw err;
      }
    }
  }
  return { workspaces: workspaces.length, created };
}

/** Oferta e produtos da campanha de mesmo nome no ano anterior / mais vendidos. */
async function suggestFromHistory(workspaceId: string, label: string) {
  const prev = await prisma.messageCampaign.findFirst({
    where: { clienteId: workspaceId, name: { startsWith: label }, status: "ENVIADA" },
    orderBy: { sentAt: "desc" },
    select: { briefing: true, couponCode: true },
  });
  const b = (prev?.briefing ?? {}) as CampaignBriefing;
  const top = await prisma.marketplaceOrderItem.groupBy({
    by: ["title"],
    where: { order: { clienteId: workspaceId, createdAt: { gte: new Date(Date.now() - 365 * DAY) } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });
  return {
    offer: b.offer || (prev?.couponCode ? `Cupom ${prev.couponCode} (usado no ano anterior)` : null),
    products: b.products?.length ? b.products : top.map((t) => t.title),
  };
}

/** Resultado da campanha (D+1 / D+3 e aba Resultados). */
export async function campaignResults(campaignId: string) {
  const [agg, conv] = await Promise.all([
    prisma.messageDelivery.groupBy({
      by: ["channel"],
      where: { campaignId, isTest: false },
      _count: { _all: true, openedAt: true, clickedAt: true, deliveredAt: true, bouncedAt: true },
      _sum: { costMicros: true },
    }),
    prisma.messageDelivery.aggregate({
      where: { campaignId, isTest: false, convertedAt: { not: null }, conversionKind: "ATTRIBUTED" },
      _count: { _all: true },
      _sum: { convertedCents: true },
    }),
  ]);
  const influenced = await prisma.messageDelivery.aggregate({
    where: { campaignId, isTest: false, convertedAt: { not: null }, conversionKind: "INFLUENCED" },
    _count: { _all: true },
    _sum: { convertedCents: true },
  });
  return {
    byChannel: agg.map((a) => ({
      channel: a.channel,
      sent: a._count._all,
      delivered: a._count.deliveredAt,
      opened: a._count.openedAt,
      clicked: a._count.clickedAt,
      bounced: a._count.bouncedAt,
      costMicros: a._sum.costMicros ?? 0,
    })),
    attributed: { orders: conv._count._all, cents: conv._sum.convertedCents ?? 0 },
    influenced: { orders: influenced._count._all, cents: influenced._sum.convertedCents ?? 0 },
  };
}
