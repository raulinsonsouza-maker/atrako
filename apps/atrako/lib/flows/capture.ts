/**
 * Captura de lead (form, LP, importação): aniversário, consentimento LGPD e fluxo de boas-vindas.
 */

import { prisma } from "@/lib/db";
import { enrollContact } from "@/lib/flows/engine";
import { upsertContactBirthday } from "@/lib/flows/important-dates";

const BIRTHDAY_KEYS = [
  "aniversario",
  "aniversário",
  "nascimento",
  "data_nascimento",
  "dataNascimento",
  "data_de_nascimento",
  "birthday",
  "birthDate",
  "birth_date",
  "dob",
];
const CONSENT_KEYS = ["consent", "consentimento", "marketingConsent", "marketing_consent", "aceite", "optin", "opt_in", "lgpd"];

function truthy(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return /^(1|true|sim|yes|on|aceito|s)$/i.test(v.trim());
  return false;
}

export function pickBirthday(payload: Record<string, unknown>): string | null {
  for (const k of BIRTHDAY_KEYS) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function pickConsent(payload: Record<string, unknown>): boolean {
  return CONSENT_KEYS.some((k) => truthy(payload[k]));
}

export async function onLeadCaptured(input: {
  workspaceId: string;
  contactId: string;
  leadId?: string | null;
  payload: Record<string, unknown>;
  source: string;
}) {
  const birthday = pickBirthday(input.payload);
  if (birthday) {
    await upsertContactBirthday({
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      raw: birthday,
      source: input.source === "lp" ? "lp" : "form",
    }).catch(() => null);
  }
  if (pickConsent(input.payload)) {
    await prisma.nativeContact.updateMany({
      where: { id: input.contactId, clienteId: input.workspaceId, marketingConsentAt: null },
      data: { marketingConsentAt: new Date(), consentSource: input.source.slice(0, 40) },
    });
  }
  // Boas-vindas só para quem ainda não comprou (comprador entra no pós-compra)
  const [profile, contact] = await Promise.all([
    prisma.customerProfile.findUnique({ where: { contactId: input.contactId }, select: { ordersCount: true } }),
    prisma.nativeContact.findUnique({ where: { id: input.contactId }, select: { email: true, phone: true } }),
  ]);
  if ((profile?.ordersCount ?? 0) > 0 || (!contact?.email && !contact?.phone)) return;
  await enrollContact({
    clienteId: input.workspaceId,
    trigger: "lead_welcome",
    contactId: input.contactId,
    leadId: input.leadId ?? null,
    refType: "lead",
    refId: input.leadId ?? null,
    dedupeKey: "welcome",
  }).catch((err) => console.warn("[flows] welcome", err instanceof Error ? err.message : err));
}
