/**
 * Primeiro contato do agente: um template aprovado, uma vez.
 * Fora do horário fica pendente para o cron. Campanha não passa por aqui.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { notify } from "@/lib/notifications";
import { loadMessagingPrefs } from "@/lib/flows/prefs";
import { sendWhatsAppMessage } from "@/lib/flows/send";
import {
  attendanceFromPrefs,
  attendanceIsOn,
  isWithinAttendanceHours,
  type AttendanceProfile,
} from "@/lib/attendance/profile";

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export async function loadAttendance(workspaceId: string) {
  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: workspaceId },
    select: { timezone: true, messagingPrefs: true },
  });
  return {
    timezone: settings?.timezone || "America/Sao_Paulo",
    profile: attendanceFromPrefs(settings?.messagingPrefs),
  };
}

export async function sendAgentWelcome(input: { workspaceId: string; contactId: string; leadId: string }) {
  const { profile, timezone } = await loadAttendance(input.workspaceId);
  if (!attendanceIsOn(profile)) return;
  const [contact, lead] = await Promise.all([
    prisma.nativeContact.findFirst({ where: { id: input.contactId, clienteId: input.workspaceId } }),
    prisma.nativeLead.findFirst({ where: { id: input.leadId, clienteId: input.workspaceId }, select: { metadata: true } }),
  ]);
  if (!contact || contact.waOptOutAt) return;
  if (!contact.phoneE164 && !contact.phone) return;
  const meta = asMeta(lead?.metadata);
  if (typeof meta.agentWelcomeAt === "string") return;
  if (!isWithinAttendanceHours(profile, timezone)) {
    await markWelcome(input.leadId, meta, { agentWelcomePending: true });
    return;
  }
  const { prefs } = await loadMessagingPrefs(input.workspaceId);
  const result = await sendWhatsAppMessage({
    clienteId: input.workspaceId,
    contact,
    content: { purpose: "sales_welcome" },
    data: {},
    origin: { flowKey: "agent_welcome" },
    automatic: true,
    reservePercent: prefs.waAutoReservePercent,
  });
  if (result.status === "SENT") {
    await markWelcome(input.leadId, meta, { agentWelcomeAt: new Date().toISOString(), agentWelcomePending: false });
    return;
  }
  if (result.reason.startsWith("template_")) {
    await notify({
      clienteId: input.workspaceId,
      role: "ADMIN",
      type: "wa.template",
      title: "Primeiro contato no WhatsApp parado",
      body: "O modelo sales_welcome ainda não está aprovado na Meta.",
      href: "/config/atendimento",
      severity: "aviso",
      dedupeKey: `wa-template:sales_welcome:${input.workspaceId}`,
      email: false,
    });
  }
  if (result.status === "DEFERRED" || result.reason.startsWith("template_")) {
    await markWelcome(input.leadId, meta, { agentWelcomePending: true });
  }
}

async function markWelcome(leadId: string, prev: Record<string, unknown>, patch: Record<string, unknown>) {
  await prisma.nativeLead.update({
    where: { id: leadId },
    data: { metadata: { ...prev, ...patch } as Prisma.InputJsonValue },
  });
}

/** Leads que ficaram fora do horário ou sem modelo aprovado. */
export async function flushPendingWelcomes() {
  const leads = await prisma.nativeLead.findMany({
    where: { status: "OPEN", metadata: { path: ["agentWelcomePending"], equals: true } },
    select: { id: true, clienteId: true, contactId: true },
    take: 30,
    orderBy: { updatedAt: "asc" },
  });
  let sent = 0;
  for (const lead of leads) {
    if (!lead.contactId) continue;
    await sendAgentWelcome({ workspaceId: lead.clienteId, contactId: lead.contactId, leadId: lead.id }).catch((err) =>
      console.warn("[attendance] welcome", err instanceof Error ? err.message : err),
    );
    sent += 1;
  }
  return { pending: leads.length, tried: sent };
}

export function welcomeBlockedByAgent(profile: AttendanceProfile) {
  return attendanceIsOn(profile);
}
