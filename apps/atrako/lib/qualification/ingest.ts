/**
 * Ingesta respostas de LP/typeform no card do lead e dispara WA se for playbook.
 */

import { prisma } from "@/lib/db";
import { QUALIFY_FIELD_KEYS, type QualifyFieldKey } from "./fields";
import { answerFromRaw, writeLeadAnswers } from "./store";
import { loadQualificationPrefs, sourceMatchesPlaybook } from "./playbook";
import { startQualificationFlow } from "./engine";
import { enrollQualifyCadence } from "./cadence";

export async function ingestFormAnswersIntoLead(input: {
  workspaceId: string;
  leadId: string;
  contactId: string | null | undefined;
  source: string;
  flat: Record<string, string>;
  channel: "lp" | "typeform" | "form";
}) {
  const prefs = await loadQualificationPrefs(input.workspaceId);
  if (!sourceMatchesPlaybook(input.source, { ...prefs, enabled: true })) {
    return { playbook: false as const };
  }

  const channelSrc = input.channel === "lp" ? "lp" : "typeform";
  const patch: Partial<Record<QualifyFieldKey, ReturnType<typeof answerFromRaw>>> = {};
  for (const key of QUALIFY_FIELD_KEYS) {
    if (key === "wa_opt_in") continue;
    const raw = input.flat[key];
    if (raw == null || !String(raw).trim()) continue;
    patch[key] = answerFromRaw(key, String(raw), channelSrc);
  }
  // Envio do form = pedido de contato (sem checkbox separado).
  patch.wa_opt_in = answerFromRaw("wa_opt_in", "sim", channelSrc);

  await writeLeadAnswers({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    playbookId: prefs.playbookId,
    patch,
    currentState: "captured",
    cadenceStatus: "running",
  });

  if (!prefs.enabled || !input.contactId) {
    return { playbook: true as const, started: false };
  }

  const contact = await prisma.nativeContact.findFirst({
    where: { id: input.contactId, clienteId: input.workspaceId },
    select: { phoneE164: true, phone: true, name: true },
  });
  const phone = contact?.phoneE164 || contact?.phone;
  if (!phone) {
    await enrollQualifyCadence({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      leadId: input.leadId,
    });
    return { playbook: true as const, started: false, reason: "no_phone" };
  }

  const started = await startQualificationFlow({
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    contactId: input.contactId,
    phone,
    contactName: contact?.name,
  });

  await enrollQualifyCadence({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    leadId: input.leadId,
  });

  return { playbook: true as const, started: started.started };
}
