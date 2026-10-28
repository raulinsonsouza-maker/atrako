/**
 * Ingesta respostas de LP/typeform no card do lead e dispara WA se for playbook.
 */

import { prisma } from "@/lib/db";
import { QUALIFY_FIELD_KEYS, type QualifyFieldKey } from "./fields";
import { answerFromRaw, writeLeadAnswers } from "./store";
import { loadQualificationPrefs, sourceMatchesPlaybook } from "./playbook";
import { startQualificationFlow } from "./engine";
import { enrollQualifyCadence } from "./cadence";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import { workspaceFormUrl } from "@/lib/lp-domains";
import { enrollContact } from "@/lib/flows/engine";
import { ensureFranchiseFlows } from "@/lib/flows/playbooks-franchise";

/** Matricula o lead na nutrição por e-mail da franquia (cria o fluxo na 1ª vez). */
async function enrollFranchiseNurture(input: {
  workspaceId: string;
  contactId: string;
  leadId: string;
  destination: string;
}) {
  await ensureFranchiseFlows(input.workspaceId);
  return enrollContact({
    clienteId: input.workspaceId,
    trigger: "franchise_nurture",
    contactId: input.contactId,
    leadId: input.leadId,
    refType: "lead",
    refId: input.leadId,
    dedupeKey: `lead:${input.leadId}`,
    context: { destination: input.destination },
  });
}

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
    select: { phoneE164: true, phone: true, name: true, email: true },
  });

  if (contact?.email && prefs.playbookId === "franchise_regicenter") {
    const cliente = await prisma.cliente.findFirst({
      where: { id: input.workspaceId },
      select: { slug: true },
    });
    const destination =
      (cliente ? workspaceFormUrl(cliente.slug, prefs.qualifyFormSlug) : null) ??
      `${getServerPublicOrigin()}/f/${prefs.qualifyFormSlug}`;
    await enrollFranchiseNurture({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      leadId: input.leadId,
      destination,
    }).catch((err) => console.warn("[qualification] nurture", err instanceof Error ? err.message : err));
  }
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
