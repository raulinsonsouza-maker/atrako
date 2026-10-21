/**
 * Cadência de quem para de responder no WhatsApp — toques e prazos do roteiro (script.followUps).
 * reask: repete a pergunta (janela aberta) · nudge: lembrete (modelo se a janela fechou) + e-mail · team: avisa a equipe.
 * Estado em NativeLead.metadata.qualification.cadence (step = índice do próximo toque).
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { loadQualificationPrefs } from "./playbook";
import { parseConversationQualify, parseLeadQualification, writeLeadAnswers } from "./store";
import { followUpQualification, startQualificationFlow } from "./engine";
import type { QualifyScript } from "./script";
import { notify } from "@/lib/notifications";
import { isWithinCustomerWindow } from "@/lib/whatsapp/domain";

type CadenceMeta = { step: number; nextAt: string | null };

const CLOSED_STATES = new Set(["meeting_requested", "human_handoff", "nurture"]);

/** Horas entre o toque anterior e o toque `step`. */
export function cadenceDelayHours(script: QualifyScript, step: number): number | null {
  const touch = script.followUps[step];
  if (!touch) return null;
  const prev = step > 0 ? script.followUps[step - 1]!.afterHours : 0;
  return Math.max(1, touch.afterHours - prev);
}

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

async function inFranchiseNurture(clienteId: string, contactId: string) {
  const n = await prisma.messageFlowEnrollment.count({
    where: { clienteId, contactId, status: { in: ["ACTIVE", "PAUSED"] }, flow: { trigger: "franchise_nurture" } },
  });
  return n > 0;
}

export async function enrollQualifyCadence(input: { workspaceId: string; contactId: string; leadId: string }) {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    select: { metadata: true },
  });
  if (!lead) return;
  const q = parseLeadQualification(lead.metadata);
  if (q.cadenceStatus === "done" || q.cadenceStatus === "paused") return;
  if (CLOSED_STATES.has(q.currentState)) return;

  const { script } = await loadQualificationPrefs(input.workspaceId);
  const delay = cadenceDelayHours(script, 0) ?? 2;
  const meta = asRecord(lead.metadata);
  const qualification = {
    ...asRecord(meta.qualification),
    cadenceStatus: "running",
    cadence: { step: 0, nextAt: new Date(Date.now() + delay * 3_600_000).toISOString() } satisfies CadenceMeta,
  };
  await prisma.nativeLead.update({
    where: { id: input.leadId },
    data: { metadata: { ...meta, qualification } as Prisma.InputJsonValue },
  });
}

export async function pauseQualifyCadence(workspaceId: string, leadId: string) {
  await writeLeadAnswers({ workspaceId, leadId, playbookId: "franchise_regicenter", patch: {}, cadenceStatus: "paused" });
}

/** Processa leads com cadence.nextAt vencido (cron). */
export async function processDueQualifyCadence(limit = 50) {
  const prefsByWs = new Map<string, Awaited<ReturnType<typeof loadQualificationPrefs>>>();
  const leads = await prisma.nativeLead.findMany({
    where: { status: "OPEN", metadata: { path: ["qualification", "cadenceStatus"], equals: "running" } },
    orderBy: { updatedAt: "desc" },
    take: 400,
    select: { id: true, clienteId: true, metadata: true, contact: true },
  });

  let processed = 0;
  for (const lead of leads) {
    if (processed >= limit) break;
    const meta = asRecord(lead.metadata);
    const q = asRecord(meta.qualification);
    const cadence = asRecord(q.cadence) as unknown as CadenceMeta;
    if (!cadence?.nextAt || new Date(cadence.nextAt).getTime() > Date.now()) continue;

    let prefs = prefsByWs.get(lead.clienteId);
    if (!prefs) {
      prefs = await loadQualificationPrefs(lead.clienteId);
      prefsByWs.set(lead.clienteId, prefs);
    }
    if (!prefs.enabled) continue;
    const script = prefs.script;

    const parsed = parseLeadQualification(lead.metadata);
    const contact = lead.contact;
    const stop = async (status: "done" | "paused") =>
      writeLeadAnswers({ workspaceId: lead.clienteId, leadId: lead.id, playbookId: prefs!.playbookId, patch: {}, cadenceStatus: status });

    if (CLOSED_STATES.has(parsed.currentState)) {
      await stop("done");
      continue;
    }
    if (!contact || contact.waOptOutAt) {
      await stop("paused");
      continue;
    }

    const step = Number(cadence.step) || 0;
    const touch = script.followUps[step];
    const phone = contact.phoneE164 || contact.phone || "";
    const conv = phone
      ? await prisma.waConversation.findFirst({
          where: { clienteId: lead.clienteId, contactId: contact.id },
          select: { id: true, status: true, qualification: true, windowExpiresAt: true },
        })
      : null;
    if (conv?.status === "HANDED_OFF") {
      await stop("done");
      continue;
    }
    const convState = parseConversationQualify(conv?.qualification);
    const followInput = conv
      ? { workspaceId: lead.clienteId, conversationId: conv.id, leadId: lead.id, phone, contactId: contact.id, contactName: contact.name }
      : null;

    if (touch?.id !== "team" && phone && !convState?.openedAt) {
      // Abertura ficou retida (modelo ainda não aprovado, limite de envio): tenta de novo.
      await startQualificationFlow({
        workspaceId: lead.clienteId,
        leadId: lead.id,
        contactId: contact.id,
        phone,
        contactName: contact.name,
        retry: true,
      }).catch(() => null);
    } else if (touch?.enabled && touch.id === "reask") {
      if (followInput && isWithinCustomerWindow(conv?.windowExpiresAt)) {
        await followUpQualification({ ...followInput, touch: "reask" }).catch(() => false);
      }
    } else if (touch?.enabled && touch.id === "nudge") {
      if (followInput && isWithinCustomerWindow(conv?.windowExpiresAt)) {
        await followUpQualification({ ...followInput, touch: "nudge" }).catch(() => false);
      } else if (phone) {
        const { sendWhatsAppMessage } = await import("@/lib/flows/send");
        const { loadMessagingPrefs } = await import("@/lib/flows/prefs");
        const { prefs: msgPrefs } = await loadMessagingPrefs(lead.clienteId);
        await sendWhatsAppMessage({
          clienteId: lead.clienteId,
          contact,
          content: { purpose: "qualify_nudge" },
          data: {},
          origin: { flowKey: "qualify_nudge" },
          automatic: true,
          reservePercent: msgPrefs.waAutoReservePercent,
        }).catch(() => null);
      }
      if (contact.email && !(await inFranchiseNurture(lead.clienteId, contact.id))) {
        const cliente = await prisma.cliente.findUnique({ where: { id: lead.clienteId }, select: { nome: true } });
        const first = contact.name?.trim().split(/\s+/)[0] || "";
        const { sendEmailMessage } = await import("@/lib/flows/send");
        await sendEmailMessage({
          clienteId: lead.clienteId,
          contact: { id: contact.id, email: contact.email, name: contact.name, phone: contact.phone, phoneE164: contact.phoneE164 },
          content: {
            subject: "Seu consultor está te esperando",
            preheader: `Cadastro recebido na ${cliente?.nome ?? "nossa empresa"}`,
            blocks: [
              {
                type: "text",
                text: `Olá${first ? `, ${first}` : ""}!\n\nRecebemos seu cadastro. Responda a mensagem no WhatsApp para falar com um consultor.`,
              },
            ],
          },
          data: {},
          origin: { flowKey: "qualify_cadence_post" },
          idempotencyKey: `qualify-email-post:${lead.id}:${step}`,
        }).catch(() => null);
      }
    } else if (touch?.enabled && touch.id === "team") {
      const days = Math.round(touch.afterHours / 24);
      await notify({
        clienteId: lead.clienteId,
        role: "ADMIN",
        type: "wa.qualify_no_reply",
        title: `${contact.name || "Lead"} não respondeu no WhatsApp`,
        body: `${days} dia${days > 1 ? "s" : ""} sem resposta à qualificação. Vale um toque manual.`,
        href: `/crm/leads/${lead.id}`,
        severity: "aviso",
        dedupeKey: `qualify-noreply:${lead.id}`,
        email: false,
      });
    }

    const nextStep = step + 1;
    const delay = cadenceDelayHours(script, nextStep);
    const nextAt = delay ? new Date(Date.now() + delay * 3_600_000).toISOString() : null;
    const fresh = await prisma.nativeLead.findUnique({ where: { id: lead.id }, select: { metadata: true } });
    const freshMeta = asRecord(fresh?.metadata);
    const qualification = {
      ...asRecord(freshMeta.qualification),
      cadenceStatus: nextAt ? "running" : "done",
      cadence: { step: nextStep, nextAt } satisfies CadenceMeta,
    };
    await prisma.nativeLead.update({
      where: { id: lead.id },
      data: { metadata: { ...freshMeta, qualification } as Prisma.InputJsonValue },
    });
    processed += 1;
  }
  return { processed };
}
