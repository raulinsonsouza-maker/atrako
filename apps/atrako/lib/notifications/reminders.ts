/**
 * Régua de avisos das campanhas (9h no fuso do workspace) e avisos operacionais
 * (Resend sem eventos, domínio não verificado, bounce/spam alto, aniversariantes sem fluxo, cron parado).
 */

import { prisma } from "@/lib/db";
import { notify, type NotificationSeverity } from "@/lib/notifications";
import { localParts } from "@/lib/flows/dates";
import { campaignResults } from "@/lib/flows/campaigns";
import { resolveResend } from "@/lib/integrations/resend/connection";
import { jobHealth } from "@/lib/flows/jobs";

const DAY = 86_400_000;
const STAGE_ORDER = ["IDEIA", "BRIEFING", "CRIACAO", "REVISAO", "APROVADA", "AGENDADA", "ENVIANDO", "ENVIADA"];
const atLeast = (status: string, target: string) => STAGE_ORDER.indexOf(status) >= STAGE_ORDER.indexOf(target);

type Rule = {
  day: number;
  /** Só avisa se a campanha ainda não chegou nesta etapa */
  unless?: string;
  title: (name: string, label: string) => string;
  body?: string;
  severity: NotificationSeverity;
  to: "owner" | "approver" | "owner_approver" | "admins" | "all";
  onlyWa?: boolean;
};

const RULES: Rule[] = [
  { day: 15, unless: "CRIACAO", title: (_n, l) => `Faltam 15 dias para ${l}: briefing e copy precisam começar`, severity: "aviso", to: "owner" },
  {
    day: 10,
    unless: "APROVADA",
    onlyWa: true,
    title: () => "Envie hoje o template de WhatsApp para aprovação da Meta",
    body: "A revisão leva até 24h e o template novo passa por pacing — ele precisa estar aprovado até D-7.",
    severity: "aviso",
    to: "owner",
  },
  { day: 10, unless: "REVISAO", title: (n) => `"${n}": a copy deve estar em revisão`, severity: "aviso", to: "owner" },
  { day: 7, unless: "REVISAO", title: (n) => `"${n}" precisa estar em revisão`, severity: "aviso", to: "owner_approver" },
  { day: 5, unless: "APROVADA", title: (n) => `Aprovação pendente: "${n}"`, severity: "aviso", to: "approver" },
  { day: 3, unless: "APROVADA", title: (n) => `Urgente: "${n}" ainda não foi aprovada`, severity: "urgente", to: "admins" },
  {
    day: 1,
    unless: "APROVADA",
    title: (n) => `Última chance: sem aprovação, "${n}" não sai amanhã`,
    severity: "urgente",
    to: "all",
  },
];

async function sendTo(
  c: { id: string; clienteId: string; ownerMemberId: string | null; approverMemberId: string | null },
  to: Rule["to"],
  base: { type: string; title: string; body?: string | null; severity: NotificationSeverity; key: string },
) {
  const href = `/relacionamento/campanhas/${c.id}`;
  const targets: Array<{ memberId?: string | null; role?: "OWNER" | "ADMIN" | null }> = [];
  if (to === "owner" || to === "owner_approver") targets.push(c.ownerMemberId ? { memberId: c.ownerMemberId } : { role: "ADMIN" });
  if (to === "approver" || to === "owner_approver") targets.push(c.approverMemberId ? { memberId: c.approverMemberId } : { role: "ADMIN" });
  if (to === "admins") targets.push({ role: "OWNER" }, { role: "ADMIN" });
  if (to === "all") targets.push({});
  const seen = new Set<string>();
  for (const t of targets) {
    const k = t.memberId ?? t.role ?? "all";
    if (seen.has(k)) continue;
    seen.add(k);
    await notify({
      clienteId: c.clienteId,
      memberId: t.memberId ?? null,
      role: t.role ?? null,
      type: base.type,
      title: base.title,
      body: base.body ?? null,
      href,
      severity: base.severity,
      dedupeKey: `${base.key}:${k}`,
    });
  }
}

async function tzOf(clienteId: string, cache: Map<string, string>) {
  let tz = cache.get(clienteId);
  if (!tz) {
    const s = await prisma.workspaceSettings.findUnique({ where: { clienteId }, select: { timezone: true } });
    tz = s?.timezone || "America/Sao_Paulo";
    cache.set(clienteId, tz);
  }
  return tz;
}

/** Roda de hora em hora; cada workspace só processa às 9h locais (dedupe impede repetição). */
export async function runCampaignReminders(now = new Date()) {
  const campaigns = await prisma.messageCampaign.findMany({
    where: { status: { notIn: ["PERDIDA"] }, OR: [{ eventDate: { not: null } }, { scheduledAt: { not: null } }, { sentAt: { not: null } }] },
  });
  const tzCache = new Map<string, string>();
  let sent = 0;
  for (const c of campaigns) {
    const tz = await tzOf(c.clienteId, tzCache);
    if (localParts(now, tz).hour !== 9) continue;
    const label = c.name.replace(/\s\d{4}$/, "");

    if (c.status === "ENVIADA" && c.sentAt) {
      const daysAfter = Math.floor((now.getTime() - c.sentAt.getTime()) / DAY);
      if (daysAfter === 1 || daysAfter === 3) {
        const r = await campaignResults(c.id);
        const opened = r.byChannel.reduce((s, x) => s + x.opened, 0);
        const clicked = r.byChannel.reduce((s, x) => s + x.clicked, 0);
        const brl = (r.attributed.cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        await sendTo(c, "owner_approver", {
          type: "campaign.result",
          title: `Resultado de "${c.name}" (D+${daysAfter}): ${opened} aberturas, ${clicked} cliques, ${brl} em vendas`,
          severity: "info",
          key: `campaign:${c.id}:D+${daysAfter}`,
        });
        sent++;
      }
      continue;
    }

    const target = c.scheduledAt ?? c.eventDate;
    if (!target) continue;
    const daysTo = Math.ceil((target.getTime() - now.getTime()) / DAY);

    // Data passou sem aprovação → Perdida
    if (daysTo < 0 && !atLeast(c.status, "APROVADA")) {
      await prisma.messageCampaign.update({ where: { id: c.id }, data: { status: "PERDIDA" } });
      await prisma.messageCampaignComment.create({
        data: { campaignId: c.id, kind: "SISTEMA", body: "A data passou sem aprovação — campanha não foi enviada." },
      });
      await sendTo(c, "all", {
        type: "campaign.lost",
        title: `"${c.name}" não foi enviada: a data passou sem aprovação`,
        severity: "urgente",
        key: `campaign:${c.id}:lost`,
      });
      sent++;
      continue;
    }

    for (const rule of RULES) {
      if (rule.day !== daysTo) continue;
      if (rule.unless && atLeast(c.status, rule.unless)) continue;
      if (rule.onlyWa && !(c.channel === "WHATSAPP" || c.channel === "BOTH")) continue;
      await sendTo(c, rule.to, {
        type: `campaign.D-${rule.day}`,
        title: rule.title(c.name, label),
        body: rule.body,
        severity: rule.severity,
        key: `campaign:${c.id}:D-${rule.day}:${rule.unless ?? ""}`,
      });
      sent++;
    }
  }
  return { campaigns: campaigns.length, sent };
}

/** Avisos operacionais (1x/dia por tipo via dedupe com a data). */
export async function runHealthChecks(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const conns = await prisma.workspaceConnection.findMany({
    where: { provider: "RESEND", status: "ACTIVE" },
    select: { clienteId: true },
  });
  let warnings = 0;
  for (const { clienteId } of conns) {
    const conn = await resolveResend(clienteId);
    if (!conn) continue;
    if (conn.domainStatus && conn.domainStatus !== "verified") {
      await notify({
        clienteId,
        role: "ADMIN",
        type: "resend.domain",
        title: "Domínio de e-mail não verificado",
        body: "Os fluxos de e-mail ficam parados até o domínio ser verificado no Resend (registros DNS).",
        href: "/config/conexoes",
        severity: "aviso",
        dedupeKey: `resend-domain:${today}`,
      });
      warnings++;
    }
    const sent24 = await prisma.messageDelivery.count({
      where: { clienteId, channel: "EMAIL", isTest: false, sentAt: { gte: new Date(now.getTime() - DAY) } },
    });
    const lastHook = conn.lastWebhookAt ? new Date(conn.lastWebhookAt) : null;
    if (sent24 >= 20 && (!lastHook || now.getTime() - lastHook.getTime() > DAY)) {
      await notify({
        clienteId,
        role: "ADMIN",
        type: "resend.webhook",
        title: "Webhook do Resend sem eventos há mais de 24h",
        body: "Aberturas e cliques podem estar desatualizados. Confira o webhook em Config → Conexões (a sincronização de backup segue ativa).",
        href: "/config/conexoes",
        severity: "aviso",
        dedupeKey: `resend-webhook:${today}`,
      });
      warnings++;
    }
    if (sent24 >= 50) {
      const [bounced, complained] = await Promise.all([
        prisma.messageDelivery.count({ where: { clienteId, channel: "EMAIL", isTest: false, bouncedAt: { gte: new Date(now.getTime() - DAY) } } }),
        prisma.messageDelivery.count({ where: { clienteId, channel: "EMAIL", isTest: false, complainedAt: { gte: new Date(now.getTime() - DAY) } } }),
      ]);
      if (bounced / sent24 > 0.04 || complained / sent24 > 0.001) {
        await notify({
          clienteId,
          role: "ADMIN",
          type: "email.reputation",
          title: "Bounce ou spam acima do limite",
          body: `Últimas 24h: ${bounced} bounces e ${complained} reclamações em ${sent24} envios. Limpe a base e reduza campanhas para proteger o domínio.`,
          href: "/relacionamento?tab=desempenho&sub=envios",
          severity: "urgente",
          dedupeKey: `email-reputation:${today}`,
        });
        warnings++;
      }
    }
  }

  // Aniversariantes da semana sem fluxo de aniversário ativo
  const withBirthdays = await prisma.contactImportantDate.groupBy({
    by: ["clienteId"],
    where: { kind: "BIRTHDAY", month: now.getUTCMonth() + 1 },
    _count: { _all: true },
  });
  for (const w of withBirthdays) {
    const active = await prisma.messageFlow.count({
      where: { clienteId: w.clienteId, trigger: "date_based", status: "ACTIVE", key: "birthday" },
    });
    if (active) continue;
    await notify({
      clienteId: w.clienteId,
      role: "ADMIN",
      type: "flows.birthday_off",
      title: `${w._count._all} aniversariantes este mês sem fluxo de aniversário ativo`,
      href: "/relacionamento",
      severity: "info",
      dedupeKey: `birthday-off:${today.slice(0, 7)}`,
      email: false,
    });
    warnings++;
  }

  const staleJobs = await alertStaleJobs(now);
  return { resendWorkspaces: conns.length, warnings, staleJobs };
}

const JOB_LABELS: Record<string, string> = {
  "flows.steps": "envio dos passos (a cada 5 min)",
  "flows.hourly": "rotina de hora em hora (datas, sync do Resend, lembretes)",
  "flows.profiles": "recálculo noturno de perfis (recompra, win-back)",
};

/** Cron parado ou falhando 3x seguidas: aviso no sino dos workspaces com fluxos ativos (1x/dia por job). */
export async function alertStaleJobs(now = new Date(), only?: string[]) {
  const health = (await jobHealth()).filter((h) => !only || only.includes(h.job));
  const bad = health.filter((h) => h.stale || h.recentFailures >= 3);
  if (!bad.length) return [];
  console.warn("[flows] cron com problema:", bad.map((b) => b.job).join(", "));
  const today = now.toISOString().slice(0, 10);
  const workspaces = await prisma.messageFlow.findMany({
    where: { status: "ACTIVE" },
    distinct: ["clienteId"],
    select: { clienteId: true },
  });
  for (const job of bad) {
    const label = JOB_LABELS[job.job] ?? job.job;
    for (const { clienteId } of workspaces) {
      await notify({
        clienteId,
        role: "ADMIN",
        type: "flows.cron",
        title: job.stale ? "Automação de mensagens parada" : "Automação de mensagens falhando",
        body: job.stale
          ? `A ${label} não roda desde ${job.lastAt ? job.lastAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "a ativação"}. A equipe Atrako foi avisada.`
          : `A ${label} falhou nas últimas 3 execuções. A equipe Atrako foi avisada.`,
        href: "/relacionamento",
        severity: "urgente",
        dedupeKey: `cron-${job.job}:${today}`,
        email: false,
      });
    }
  }
  return bad.map((b) => b.job);
}
