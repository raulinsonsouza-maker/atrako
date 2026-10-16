/**
 * Cadência e-mail + WA follow-up até reunião/handoff.
 * Estado em NativeLead.metadata.qualification.cadence*.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import { loadQualificationPrefs } from "./playbook";
import { parseLeadQualification, writeLeadAnswers } from "./store";
import { followUpQualification } from "./engine";
import { missingFieldKeys, WA_ASK_ORDER } from "./fields";

type CadenceMeta = {
  step: number;
  nextAt: string | null;
};

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
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
  if (q.priority === "A" || q.priority === "B") return;

  const meta = asRecord(lead.metadata);
  const qualification = {
    ...asRecord(meta.qualification),
    cadenceStatus: "running",
    cadence: { step: 0, nextAt: new Date(Date.now() + 2 * 3_600_000).toISOString() } satisfies CadenceMeta,
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
    if (parsed.priority === "A" || parsed.priority === "B") {
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

    if (step === 0 && contact.email) {
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

    if ((step === 1 || step === 0) && missing.length && (contact.phoneE164 || contact.phone)) {
      const conv = await prisma.waConversation.findFirst({
        where: { clienteId: lead.clienteId, contactId: contact.id },
        select: { id: true },
      });
      if (conv) {
        await followUpQualification({
          workspaceId: lead.clienteId,
          conversationId: conv.id,
          leadId: lead.id,
          phone: contact.phoneE164 || contact.phone || "",
          contactId: contact.id,
          contactName: contact.name,
        }).catch(() => false);
      }
    }

    const nextStep = step + 1;
    const nextAt =
      nextStep >= 3
        ? null
        : new Date(Date.now() + (nextStep === 1 ? 24 * 3_600_000 : 48 * 3_600_000)).toISOString();

    const qualification = {
      ...q,
      cadenceStatus: nextAt ? "running" : "done",
      cadence: { step: nextStep, nextAt },
    };
    await prisma.nativeLead.update({
      where: { id: lead.id },
      data: { metadata: { ...meta, qualification } as Prisma.InputJsonValue },
    });
    processed += 1;
  }
  return { processed };
}
