/**
 * Cadência e-mail + WA follow-up até o lead engajar (apresentação / quero conversar).
 * Estado em NativeLead.metadata.qualification.cadence*.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import { loadQualificationPrefs } from "./playbook";
import { parseLeadQualification, writeLeadAnswers } from "./store";
import { followUpQualification } from "./engine";
import { missingFieldKeys, WA_ASK_ORDER } from "./fields";
import { postFormFollowUpCopy } from "./messages";
import { sendAndPersistReplyButtons } from "@/lib/whatsapp/domain";
import { notify } from "@/lib/notifications";

type CadenceMeta = {
  step: number;
  nextAt: string | null;
  kind?: "nurture" | "post_form";
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Com a nutrição da franquia ativa, os e-mails são dela (limite de 1 por dia). */
async function inFranchiseNurture(clienteId: string, contactId: string) {
  const n = await prisma.messageFlowEnrollment.count({
    where: { clienteId, contactId, status: { in: ["ACTIVE", "PAUSED"] }, flow: { trigger: "franchise_nurture" } },
  });
  return n > 0;
}

export async function enrollQualifyCadence(input: {
  workspaceId: string;
  contactId: string;
  leadId: string;
}) {
  const lead = await prisma.nativeLead.findFirst({
    where: { id: input.leadId, clienteId: input.workspaceId },
    select: { metadata: true },
  });
  if (!lead) return;
  const q = parseLeadQualification(lead.metadata);
  if (q.cadenceStatus === "done" || q.cadenceStatus === "paused") return;
  if (q.currentState === "meeting_requested" || q.currentState === "human_handoff") return;

  const kind: CadenceMeta["kind"] =
    q.currentState === "awaiting_post_form_engagement" || q.missing.length === 0
      ? "post_form"
      : "nurture";

  const meta = asRecord(lead.metadata);
  const qualification = {
    ...asRecord(meta.qualification),
    cadenceStatus: "running",
    cadence: {
      step: 0,
      nextAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      kind,
    } satisfies CadenceMeta,
  };
  await prisma.nativeLead.update({
    where: { id: input.leadId },
    data: { metadata: { ...meta, qualification } as Prisma.InputJsonValue },
  });
}

export async function pauseQualifyCadence(workspaceId: string, leadId: string) {
  await writeLeadAnswers({
    workspaceId,
    leadId,
    playbookId: "franchise_regicenter",
    patch: {},
    cadenceStatus: "paused",
  });
}

/** Processa leads com cadence.nextAt vencido (chamar de cron). */
export async function processDueQualifyCadence(limit = 50) {
  const prefsByWs = new Map<string, Awaited<ReturnType<typeof loadQualificationPrefs>>>();
  const leads = await prisma.nativeLead.findMany({
    where: { status: "OPEN" },
    orderBy: { updatedAt: "desc" },
    take: 400,
    select: {
      id: true,
      clienteId: true,
      contactId: true,
      metadata: true,
      contact: { select: { id: true, email: true, phone: true, phoneE164: true, name: true, waOptOutAt: true } },
    },
  });

  let processed = 0;
  for (const lead of leads) {
    if (processed >= limit) break;
    const meta = asRecord(lead.metadata);
    const q = asRecord(meta.qualification);
    if (q.cadenceStatus !== "running") continue;
    const cadence = asRecord(q.cadence) as unknown as CadenceMeta;
    if (!cadence?.nextAt || new Date(cadence.nextAt).getTime() > Date.now()) continue;

    let prefs = prefsByWs.get(lead.clienteId);
    if (!prefs) {
      prefs = await loadQualificationPrefs(lead.clienteId);
      prefsByWs.set(lead.clienteId, prefs);
    }
    if (!prefs.enabled) continue;

    const parsed = parseLeadQualification(lead.metadata);
    if (parsed.currentState === "meeting_requested" || parsed.currentState === "human_handoff") {
      await writeLeadAnswers({
        workspaceId: lead.clienteId,
        leadId: lead.id,
        playbookId: prefs.playbookId,
        patch: {},
        cadenceStatus: "done",
      });
      continue;
    }

    const step = Number(cadence.step) || 0;
    const contact = lead.contact;
    if (!contact || contact.waOptOutAt) {
      await writeLeadAnswers({
        workspaceId: lead.clienteId,
        leadId: lead.id,
        playbookId: prefs.playbookId,
        patch: {},
        cadenceStatus: "paused",
      });
      continue;
    }

    const missing = missingFieldKeys(parsed.answers, prefs.askKeys.length ? prefs.askKeys : WA_ASK_ORDER);
    const origin = getServerPublicOrigin();
    const formUrl = `${origin}/f/${prefs.qualifyFormSlug}`;
    const kind = cadence.kind || (missing.length === 0 ? "post_form" : "nurture");
    const phone = contact.phoneE164 || contact.phone || "";

    if (kind === "post_form") {
      if (step === 0 || step === 1) {
        const conv = await prisma.waConversation.findFirst({
          where: { clienteId: lead.clienteId, contactId: contact.id },
          select: { id: true, status: true },
        });
        if (conv && conv.status !== "HANDED_OFF" && phone) {
          const copy = postFormFollowUpCopy(contact.name);
          await sendAndPersistReplyButtons({
            workspaceId: lead.clienteId,
            to: phone,
            body: copy.body,
            buttons: copy.buttons,
            contactId: contact.id,
            contactName: contact.name,
          }).catch(() => null);
        }
      }
      if (step === 1 && contact.email && !(await inFranchiseNurture(lead.clienteId, contact.id))) {
        try {
          const { sendEmailMessage } = await import("@/lib/flows/send");
          const first = contact.name?.trim().split(/\s+/)[0] || "";
          await sendEmailMessage({
            clienteId: lead.clienteId,
            contact: {
              id: contact.id,
              email: contact.email,
              name: contact.name,
              phone: contact.phone,
              phoneE164: contact.phoneE164,
            },
            content: {
              subject: "Ainda dá tempo de conversarmos sobre a franquia",
              preheader: "Resumo rápido da Regicenter",
              blocks: [
                {
                  type: "text",
                  text: `Olá${first ? `, ${first}` : ""}!\n\nRecebemos seu cadastro da franquia Regicenter. Se quiser seguir, responda a mensagem no WhatsApp — a equipe continua por lá.`,
                },
              ],
            },
            data: {},
            origin: { flowKey: "qualify_cadence_post" },
            idempotencyKey: `qualify-email-post:${lead.id}:${step}`,
          }).catch(() => null);
        } catch {
          /* e-mail opcional */
        }
      }
      if (step >= 2) {
        await notify({
          clienteId: lead.clienteId,
          role: "ADMIN",
          type: "wa.qualify_no_reply",
          title: "Lead franquia sem resposta no WhatsApp",
          body: `${contact.name || "Lead"} não respondeu à cadência. Vale um toque manual.`,
          href: "/whatsapp",
          severity: "aviso",
          dedupeKey: `qualify-noreply:${lead.id}`,
          email: false,
        });
      }
    } else {
      if (step === 0 && contact.email && missing.length && !(await inFranchiseNurture(lead.clienteId, contact.id))) {
        try {
          const { sendEmailMessage } = await import("@/lib/flows/send");
          const first = contact.name?.trim().split(/\s+/)[0] || "";
          await sendEmailMessage({
            clienteId: lead.clienteId,
            contact: {
              id: contact.id,
              email: contact.email,
              name: contact.name,
              phone: contact.phone,
              phoneE164: contact.phoneE164,
            },
            content: {
              subject: "Continue sua qualificação",
              preheader: "Faltam poucos minutos",
              blocks: [
                {
                  type: "text",
                  text: `Olá${first ? `, ${first}` : ""}!\n\nPara continuarmos, complete as perguntas rápidas.`,
                },
                { type: "button", label: "Continuar em 2 minutos", url: formUrl },
              ],
            },
            data: { destination: formUrl },
            origin: { flowKey: "qualify_cadence" },
            idempotencyKey: `qualify-email:${lead.id}:${step}`,
          }).catch(() => null);
        } catch {
          /* e-mail opcional */
        }
      }

      if ((step === 1 || step === 0) && missing.length && phone) {
        const conv = await prisma.waConversation.findFirst({
          where: { clienteId: lead.clienteId, contactId: contact.id },
          select: { id: true },
        });
        if (conv) {
          await followUpQualification({
            workspaceId: lead.clienteId,
            conversationId: conv.id,
            leadId: lead.id,
            phone,
            contactId: contact.id,
            contactName: contact.name,
          }).catch(() => false);
        }
      }
    }

    const nextStep = step + 1;
    const maxSteps = kind === "post_form" ? 3 : 3;
    const nextAt =
      nextStep >= maxSteps
        ? null
        : new Date(Date.now() + (nextStep === 1 ? 22 * 3_600_000 : 48 * 3_600_000)).toISOString();

    const qualification = {
      ...q,
      cadenceStatus: nextAt ? "running" : "done",
      cadence: { step: nextStep, nextAt, kind },
    };
    await prisma.nativeLead.update({
      where: { id: lead.id },
      data: { metadata: { ...meta, qualification } as Prisma.InputJsonValue },
    });
    processed += 1;
  }
  return { processed };
}
